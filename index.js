// Copyright 2021 DeepL GmbH (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const express = require('express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const languages = require('./languages');
const documents = require('./documents');
const auth = require('./auth');

function getParam(req, name, options) {
  const src = req.method === 'GET' ? req.query : req.body;
  let v = src[name];

  if (options?.multi) {
    if (v === undefined) v = [];
    v = Array.isArray(v) ? v : [v];
    if (options?.required && v.length === 0) throw new Error(`Parameter '${name}' not specified`);
  } else {
    v = Array.isArray(v) ? v[0] : v;
    if (options?.required && v === undefined) throw new Error(`Parameter '${name}' not specified`);
    else if (v === undefined) v = options?.default;

    if (options?.lower && v) v = v.toLowerCase();
    else if (options?.upper && v) v = v.toUpperCase();

    if (options?.validator && options?.validator(v) === false) throw new Error(`Value for '${name}' not supported.`);
    if (options?.allowedValues && !options?.allowedValues.includes(v)) throw new Error(`Value for '${name}' not supported.`);
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
    const textArray = getParam(req, 'text', { multi: true, required: true });

    // The following parameters are validated but not used by the mock server
    getParam(req, 'formality', {
      default: 'default', allowedValues: ['less', 'more', 'default'],
    });
    getParam(req, 'tag_handling', { default: 'xml', allowedValues: ['xml'] });
    getParam(req, 'outline_detection', { default: '0', allowedValues: ['0'] });

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
        translations: textArray.map((text) => languages.translate(text, targetLang, sourceLang)),
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
          const document = await documents.createDocument(file, authKey, targetLang, sourceLang);
          res.status(200).send({
            document_id: document.id,
            document_key: document.key,
          });
          await documents.translateDocument(document, req.session);
        }
      } catch (err) {
        res.status(err.status).send({ message: err.message });
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
      res.status(503).send();
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

app.get('/v2/languages', auth, handleLanguages);
app.post('/v2/languages', auth, handleLanguages);

app.get('/v2/usage', auth, handleUsage);
app.post('/v2/usage', auth, handleUsage);

app.get('/v2/translate', auth, handleTranslate);
app.post('/v2/translate', auth, handleTranslate);

app.post('/v2/document', auth, handleDocument);

app.get('/v2/document/:document_id', auth, handleDocumentStatus);
app.post('/v2/document/:document_id', auth, handleDocumentStatus);

app.get('/v2/document/:document_id/result', auth, handleDocumentDownload);
app.post('/v2/document/:document_id/result', auth, handleDocumentDownload);

app.all('/*', (req, res) => {
  res.status(404).send();
});

const envVarPort = 'DEEPL_MOCK_SERVER_PORT';
const port = Number(process.env[envVarPort]);
if (Number.isNaN(port)) {
  console.error(`The ${envVarPort} environment variable must be defined as the port number.`);
  process.exit(2);
}

app.listen(port, () => {
  console.log(`DeepL API mock-server listening at http://localhost:${port}`);
}).on('error', (error) => {
  console.error(`Error occurred while starting the server: ${error}`);
  process.exit(1);
});
