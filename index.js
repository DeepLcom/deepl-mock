// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const express = require('express');
const httpProxy = require('http-proxy');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const nocache = require('nocache');

app.use(nocache());

const fileUpload = require('express-fileupload');

app.use(fileUpload({
  createParentPath: true,
}));

const morgan = require('morgan');
// Logging utility
app.use(morgan('dev')); // Developer-style formatting

const sessions = require('./sessions');

app.use(sessions());
const auth = require('./auth');
const documents = require('./documents');
const glossaries = require('./glossaries');
const languages = require('./languages');
const util = require('./util');

const envVarPort = 'DEEPL_MOCK_SERVER_PORT';
const envVarProxyPort = 'DEEPL_MOCK_PROXY_SERVER_PORT';

const port = Number(process.env[envVarPort]);
const proxyPort = Number(process.env[envVarProxyPort]);

if (Number.isNaN(port)) {
  console.error(`The ${envVarPort} environment variable must be defined as the port number.`);
  process.exit(2);
}
if (Number.isNaN(proxyPort)) {
  console.info(`The ${envVarProxyPort} environment variable is not defined, no proxy will be used.`);
}

function requireUserAgent(req, res, next) {
  const userAgentHeader = req.headers['user-agent'];
  if (userAgentHeader === undefined || userAgentHeader === '') {
    res.status(400).send({ message: 'User-Agent header missing.' });
    return undefined; // Give no response and do not continue with next handler
  }

  return next();
}

function getParam(req, name, options) {
  let v = req.body[name] || req.query[name];

  if (options?.params) {
    v = req.params[name];
  }

  if (options?.multi) {
    if (v === undefined) v = [];
    v = Array.isArray(v) ? v : [v];
    if (options?.required && v.length === 0) {
      if (options?.newErrorMessage) throw new util.HttpError(`Missing or invalid argument: ${name}'`);
      throw new util.HttpError(`Parameter '${name}' not specified`);
    }
  } else {
    v = Array.isArray(v) ? v[0] : v;
    if (options?.required && v === undefined) {
      if (options?.newErrorMessage) throw new util.HttpError(`Missing or invalid argument: ${name}'`);
      throw new util.HttpError(`Parameter '${name}' not specified`);
    } else if (v === undefined && options?.default !== undefined) {
      return options?.default;
    }

    if (options?.lower && v) v = v.toLowerCase();
    else if (options?.upper && v) v = v.toUpperCase();

    if (options?.validator && options?.validator(v) === false) {
      if (options?.newErrorMessage) throw new util.HttpError(`Missing or invalid argument: ${name}'`);
      throw new util.HttpError(`Value for '${name}' not supported.`);
    }
    if (options?.allowedValues && !options?.allowedValues.includes(v)) {
      if (options?.newErrorMessage) throw new util.HttpError(`Missing or invalid argument: ${name}'`);
      throw new util.HttpError(`Value for '${name}' not supported.`);
    }
  }

  return v;
}

function checkLimit(usage, type, request) {
  /* eslint-disable no-param-reassign */
  // Note: this function modifies the usage argument, incrementing the count used
  const count = `${type}_count`;
  const limit = `${type}_limit`;

  if (usage[limit] === undefined) return true;
  if (usage[count] + request > usage[limit]) return false;

  usage[count] += request;
  return true;
  /* eslint-enable no-param-reassign */
}

async function handleLanguages(req, res) {
  try {
    const paramType = getParam(req, 'type', {
      default: 'source',
      validator: (type) => {
        if (!['source', 'target'].includes(type)) {
          throw new Error("Parameter 'type' is invalid. 'source' and 'target' are valid values.");
        }
      },
    });

    if (paramType === 'target') {
      res.send(languages.getTargetLanguages());
    } else {
      res.send(languages.getSourceLanguages());
    }
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
}

async function handleUsage(req, res) {
  res.send(req.user_account.usage);
}

async function handleTranslate(req, res) {
  try {
    const targetLang = getParam(req, 'target_lang', {
      upper: true, validator: languages.isTargetLanguage,
    });
    const sourceLang = getParam(req, 'source_lang', {
      upper: true, validator: languages.isSourceLanguage,
    });
    const { authKey } = req.user_account;
    const textArray = getParam(req, 'text', { multi: true, required: true });

    const glossaryId = getParam(req, 'glossary_id',
      { validator: (id) => (id === undefined || glossaries.isValidGlossaryId(id)) });
    if (glossaryId !== undefined && sourceLang === undefined) {
      throw new util.HttpError('Use of a glossary requires the source_lang parameter to be specified', 400);
    }
    const glossary = glossaryId === undefined ? undefined
      : glossaries.getGlossary(glossaryId, authKey);

    // The following parameters are validated but not used by the mock server
    getParam(req, 'split_sentences', { default: '1', allowedValues: ['0', '1', 'nonewlines'] });
    getParam(req, 'preserve_formatting', { default: '0', allowedValues: ['0', '1'] });
    getParam(req, 'formality', {
      default: 'default',
      allowedValues: ['less', 'more', 'default'],
      validator: () => {
        if (!languages.supportsFormality(targetLang)) {
          throw new util.HttpError("'formality' is not supported for given 'target_lang'.", 400);
        }
      },
    });
    getParam(req, 'tag_handling', { default: 'xml', allowedValues: ['html', 'xml'] });
    getParam(req, 'outline_detection', { default: '1', allowedValues: ['0', '1'] });

    // Calculate the character count of the requested translation
    const totalCharacters = textArray.reduce((total, text) => (total + text.length), 0);

    // Check if session is configured to respond with 429: too-many-requests
    if (req.session.respond_429_count > 0) {
      req.session.respond_429_count -= 1;
      res.status(429).send();
    } else if (!checkLimit(req.user_account.usage, 'character', totalCharacters)) {
      res.status(456).send({ message: 'Quota for this billing period has been exceeded.' });
    } else {
      const body = {
        translations: textArray.map((text) => languages.translate(text, targetLang, sourceLang,
          glossary)),
      };
      res.status(200).send(body);
    }
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
}

async function handleDocument(req, res) {
  try {
    const targetLang = getParam(req, 'target_lang', {
      upper: true, validator: languages.isTargetLanguage,
    });
    const sourceLang = getParam(req, 'source_lang', {
      upper: true, validator: languages.isSourceLanguage,
    });
    const { authKey } = req.user_account;
    getParam(req, 'formality', {
      default: 'default',
      allowedValues: ['less', 'more', 'default'],
      validator: () => {
        if (!languages.supportsFormality(targetLang)) {
          throw new util.HttpError('formality is not supported for given target_lang.', 400);
        }
      },
    });

    const glossaryId = getParam(req, 'glossary_id',
      { validator: (id) => (id === undefined || glossaries.isValidGlossaryId(id)) });
    if (glossaryId !== undefined && sourceLang === undefined) {
      throw new util.HttpError('Use of a glossary requires the source_lang parameter to be specified', 400);
    }
    const glossary = glossaryId === undefined ? undefined
      : glossaries.getGlossary(glossaryId, authKey);

    if (!req.files || req.files.file === undefined) {
      res.status(400).send({ message: 'Invalid file data.' });
    } else {
      const { file } = req.files;
      try {
        // Mock server simplification: billed characters assumed to be file size
        const totalCharacters = file.size;
        if (!checkLimit(req.user_account.usage, 'character', totalCharacters)
                    || !checkLimit(req.user_account.usage, 'document', 1)
                    || !checkLimit(req.user_account.usage, 'team_document', 1)) {
          res.status(456).send({ message: 'Quota for this billing period has been exceeded.' });
        } else {
          const document = await documents.createDocument(file, authKey, targetLang, sourceLang,
            glossary);
          res.status(200).send({
            document_id: document.id,
            document_key: document.key,
          });
          await documents.translateDocument(document, req.session);
        }
      } catch (err) {
        res.status(err.status()).send(err.body());
      }
    }
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
}

async function handleDocumentStatus(req, res) {
  try {
    const { authKey } = req.user_account;
    console.log('authKey:', authKey);
    const documentKey = getParam(req, 'document_key', { single: true });
    console.log('documentKey:', documentKey);
    const document = documents.getDocument(req.params.document_id, documentKey, authKey,
      req.session);
    console.log('document:', document);

    const body = {
      document_id: document.id,
      status: document.status,
    };

    if (document.status === 'translating') {
      body.seconds_remaining = document.seconds_remaining;
    } else if (document.status === 'done') {
      body.seconds_remaining = document.seconds_remaining;
      body.billed_characters = document.billed_characters;
    } else if (document.status === 'error') {
      body.error_message = document.error_message;
      // Field 'message' is also set for backward compatibility
      body.message = document.error_message;
    }

    res.status(200).send(body);
  } catch (err) {
    console.log(err.message);
    res.status(404).send();
  }
}

async function handleDocumentDownload(req, res) {
  try {
    const { authKey } = req.user_account;
    const documentKey = getParam(req, 'document_key', { single: true });
    const document = documents.getDocument(req.params.document_id, documentKey, authKey,
      req.session);

    if (document.status !== 'done') {
      res.status(503).send({ message: 'Document translation is not done' });
    } else {
      res.status(200);
      res.download(document.path_out, document.name, (err) => {
        if (err) {
          console.log(`Error occurred during file download: ${err}`);
        } else {
          documents.removeDocument(document);
        }
      });
    }
  } catch {
    res.status(404).send();
  }
}

async function handleGlossaryList(req, res) {
  try {
    // Access glossary_id param from path, note: glossary_id is optional, so may be undefined
    const glossaryId = getParam(req, 'glossary_id',
      {
        params: true,
        validator: (id) => (id === undefined || glossaries.isValidGlossaryId(id)),
      });
    const { authKey } = req.user_account;

    if (glossaryId !== undefined) {
      const glossaryInfo = glossaries.getGlossaryInfo(glossaryId, authKey);
      res.status(200).send(glossaryInfo);
    } else {
      const glossaryList = glossaries.getGlossaryInfoList(authKey);
      res.status(200).send({ glossaries: glossaryList });
    }
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleGlossaryEntries(req, res) {
  try {
    if (req.accepts('text/tab-separated-values')) {
      const glossaryId = getParam(req, 'glossary_id',
        {
          params: true,
          required: true,
          validator: (id) => (id === undefined || glossaries.isValidGlossaryId(id)),
        });
      const { authKey } = req.user_account;
      const entries = glossaries.getGlossaryEntries(glossaryId, authKey);
      res.contentType('text/tab-separated-values; charset=UTF-8');
      res.status(200).send(entries);
    } else {
      res.status(415).send({ message: 'No supported media type specified in Accept header' });
    }
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

function handleGlossaryLanguages(req, res) {
  try {
    res.status(200).send(
      {
        supported_languages: glossaries.supportedLanguages,
      },
    );
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send(err.body());
  }
}

async function handleGlossaryCreate(req, res) {
  try {
    const { authKey } = req.user_account;

    const targetLang = getParam(req, 'target_lang', {
      upper: true, validator: languages.isGlossaryLanguage,
    });
    const sourceLang = getParam(req, 'source_lang', {
      upper: true, validator: languages.isGlossaryLanguage,
    });
    const name = getParam(req, 'name', {
      required: true,
      newErrorMessage: true,
      validator: (value) => value.length !== 0,
    });
    const entries = getParam(req, 'entries', { required: true });
    const entriesFormat = getParam(req, 'entries_format', {
      required: true,
      validator: (value) => {
        if (value !== 'tsv' && value !== 'csv') {
          throw new util.HttpError('Unsupported entry format specified', 401);
        }
      },
    });
    const glossaryInfo = await glossaries.createGlossary(name, authKey, targetLang, sourceLang,
      entriesFormat, entries);
    res.status(201).send(glossaryInfo);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send(err.body());
  }
}

async function handleGlossaryDelete(req, res) {
  try {
    const glossaryId = getParam(req, 'glossary_id',
      {
        params: true,
        required: true,
        validator: (id) => (id === undefined || glossaries.isValidGlossaryId(id)),
      });
    const { authKey } = req.user_account;
    glossaries.removeGlossary(glossaryId, authKey);
    res.status(204).send();
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

app.get('/v2/languages', auth, requireUserAgent, handleLanguages);
app.post('/v2/languages', auth, requireUserAgent, handleLanguages);

app.get('/v2/usage', auth, requireUserAgent, handleUsage);
app.post('/v2/usage', auth, requireUserAgent, handleUsage);

app.get('/v2/translate', auth, requireUserAgent, handleTranslate);
app.post('/v2/translate', auth, requireUserAgent, handleTranslate);

app.post('/v2/document', auth, requireUserAgent, handleDocument);

app.get('/v2/document/:document_id', auth, requireUserAgent, handleDocumentStatus);
app.post('/v2/document/:document_id', auth, requireUserAgent, handleDocumentStatus);

app.get('/v2/document/:document_id/result', auth, requireUserAgent, handleDocumentDownload);
app.post('/v2/document/:document_id/result', auth, requireUserAgent, handleDocumentDownload);

app.get('/v2/glossary-language-pairs', auth, requireUserAgent, handleGlossaryLanguages);
app.post('/v2/glossaries', auth, requireUserAgent, handleGlossaryCreate);
app.get('/v2/glossaries', auth, requireUserAgent, handleGlossaryList);
app.get('/v2/glossaries/:glossary_id', auth, requireUserAgent, handleGlossaryList);
app.get('/v2/glossaries/:glossary_id/entries', auth, requireUserAgent, handleGlossaryEntries);
app.delete('/v2/glossaries/:glossary_id', auth, requireUserAgent, handleGlossaryDelete);

app.all('/*', (req, res) => {
  res.status(404).send();
});

app.listen(port, () => {
  console.log(`DeepL API mock-server listening on port ${port}`);
}).on('error', (error) => {
  console.error(`Error occurred while starting the server: ${error}`);
  process.exit(1);
});

if (!Number.isNaN(proxyPort)) {
  const proxyApp = express();
  const proxy = httpProxy.createProxyServer({});
  proxyApp.all('*', (req, res) => {
    console.log('Proxying request:', req.method, req.url);
    req.headers.forwarded = `for=${req.ip}`;
    proxy.web(req, res, { target: `http://localhost:${port}` }, (err) => {
      console.log('Error while proxying request:', err);
    });
  });
  proxyApp.listen(proxyPort, () => {
    console.log(`DeepL API mock-proxy-server listening on port ${proxyPort}`);
  });
}
