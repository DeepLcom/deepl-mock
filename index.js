// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const express = require('express');
const httpProxy = require('http-proxy');

const app = express();

// parsing form x-www-form-urlencoded request bodies
const qs = require('qs');

const qsparse = qs.parse;
qs.parse = (str, options) => qsparse(str, {
  ...options,
  allowDots: true,
});
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
const glossariesV2 = require('./glossariesV2');
const glossariesV3 = require('./glossariesV3');
const languages = require('./languages');
const { writingStyles, WritingStyle } = require('./writing_styles');
const { writingTones, WritingTone } = require('./writing_tones');
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
  if ((userAgentHeader === undefined || userAgentHeader === '') && !req.session?.allow_missing_user_agent) {
    // Give no response and do not continue with next handler
    res.status(400).send({ message: 'User-Agent header missing.' });
    return undefined;
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
    } else if (v === undefined) {
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

function getParamFormality(req, targetLang) {
  return getParam(req, 'formality', {
    default: 'default',
    allowedValues: ['less', 'more', 'default', 'prefer_less', 'prefer_more'],
    validator: (formality) => {
      if (!languages.supportsFormality(targetLang, formality)) {
        throw new util.HttpError("'formality' is not supported for given 'target_lang'.", 400);
      }
    },
  });
}

function getParamWritingStyle(req, targetLang) {
  return getParam(req, 'writing_style', {
    allowedValues: writingStyles,
    lower: true,
    validator: (style) => {
      if (!languages.supportsWritingStyle(targetLang, style)) {
        const langName = languages.getLanguageName(targetLang);
        throw new util.HttpError(`Language ${langName} does not support setting a writing style.`, 400);
      }
    },
  });
}

function getParamTone(req, targetLang) {
  return getParam(req, 'tone', {
    allowedValues: writingTones,
    lower: true,
    validator: (tone) => {
      if (!languages.supportsWritingTone(targetLang, tone)) {
        const langName = languages.getLanguageName(targetLang);
        throw new util.HttpError(`Language ${langName} does not support setting a tone.`, 400);
      }
    },
  });
}

function getParamGlossary(req, sourceLang) {
  const { authKey } = req.user_account;
  const glossaryId = getParam(req, 'glossary_id',
    { validator: (id) => (id === undefined || glossariesV2.isValidGlossaryId(id)) });
  if (glossaryId !== undefined && sourceLang === undefined) {
    throw new util.HttpError('Use of a glossary requires the source_lang parameter to be specified', 400);
  }
  try {
    return glossaryId === undefined ? undefined : glossariesV2.getGlossary(glossaryId, authKey);
  } catch {
    return glossaryId === undefined ? undefined : glossariesV3.getGlossary(glossaryId, authKey);
  }
}

function getParamGlossaryId(req, required = true) {
  return getParam(req, 'glossary_id',
    {
      params: true,
      required,
      validator: (id) => (id === undefined || glossariesV2.isValidGlossaryId(id)),
    });
}

function getParamSourceLang(req, required = true) {
  return getParam(req, 'source_lang',
    {
      required,
      upper: true,
      validator: languages.isGlossaryLanguage,
    });
}

function getParamTargetLang(req, required = true) {
  return getParam(req, 'target_lang',
    {
      required,
      upper: true,
      validator: languages.isGlossaryLanguage,
    });
}

function getParamDictionaries(req, required = true) {
  const glossaryDicts = getParam(req, 'dictionaries', {
    required, multi: true,
  });
  return glossaryDicts.map((glossaryDict) => ({
    sourceLang: glossaryDict.source_lang,
    targetLang: glossaryDict.target_lang,
    entries: glossaryDict.entries,
    entriesFormat: glossaryDict.entries_format,
  }));
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
  const { usage } = req.user_account;

  // Create the base response with character count and limit
  const response = {
    character_count: usage.character_count,
    character_limit: usage.character_limit,
    start_time: usage.start_time,
    end_time: usage.end_time,
  };

  // For Pro accounts, include additional fields
  if (!req.user_account.authKey.endsWith(':fx')) {
    response.api_key_character_count = usage.character_count;
    response.api_key_character_limit = usage.character_limit;

    // Add products array for Pro accounts
    response.products = [
      {
        product_type: 'translate',
        api_key_character_count: usage.character_count,
        character_count: usage.character_count,
      },
    ];
  }

  res.send(response);
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
    const glossary = getParamGlossary(req, sourceLang);

    // The following parameters are validated but not used by the mock server
    getParam(req, 'split_sentences', { default: '1', allowedValues: ['0', '1', 'nonewlines'] });
    getParam(req, 'preserve_formatting', { default: '0', allowedValues: ['0', '1', true, false] });
    getParamFormality(req, targetLang);
    getParam(req, 'tag_handling', { default: 'xml', allowedValues: ['html', 'xml'] });
    getParam(req, 'outline_detection', { default: '1', allowedValues: ['0', '1', true, false] });
    const showBilledCharacters = getParam(req, 'show_billed_characters', { default: false, allowedValues: ['0', '1', true, false] });
    const modelType = getParam(req, 'model_type', { allowedValues: ['quality_optimized', 'latency_optimized', 'prefer_quality_optimized'] });

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
        translations: textArray.map((text) => {
          const result = languages.translate(text, targetLang, sourceLang, glossary);
          if (showBilledCharacters) {
            result.billed_characters = text.length;
          }
          if (modelType) {
            result.model_type_used = modelType.replace('prefer_', '');
          }
          return result;
        }),
      };
      res.status(200).send(body);
    }
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
}

async function handleRephrase(req, res) {
  try {
    let targetLang = getParam(req, 'target_lang', {
      upper: true,
      validator: (langCode) => languages.isTargetLanguage(langCode)
          && languages.supportsWrite(langCode),
    });
    if (targetLang === 'EN') {
      targetLang = 'EN-US';
    } else if (targetLang === 'PT') {
      targetLang = 'PT-PT';
    }
    const textArray = getParam(req, 'text', { multi: true, required: true });

    // The following parameters are validated but not used by the mock server
    const writingStyle = getParamWritingStyle(req, targetLang);
    const tone = getParamTone(req, targetLang);
    if (writingStyle !== undefined && writingStyle !== null
        && writingStyle !== WritingStyle.DEFAULT && writingStyle !== WritingStyle.PREFER_DEFAULT
        && tone !== undefined && tone !== null
        && tone !== WritingTone.DEFAULT && tone !== WritingTone.PREFER_DEFAULT) {
      throw new util.HttpError('Bad request. Reason: Both writing_style and tone defined. Currently only style OR tone can be chosen for a single request.', 400);
    }

    // Calculate the character count of the requested text improvement
    const totalCharacters = textArray.reduce((total, text) => (total + text.length), 0);

    // Check if session is configured to respond with 429: too-many-requests
    if (req.session.respond_429_count > 0) {
      req.session.respond_429_count -= 1;
      res.status(429).send();
    } else if (
      !checkLimit(req.user_account.usage, 'character', totalCharacters)
    ) {
      res
        .status(456)
        .send({ message: 'Quota for this billing period has been exceeded.' });
    } else {
      const body = {
        improvements: textArray.map((text) => {
          const result = languages.rephrase(
            text,
            util.convertToBcp47(targetLang),
          );
          return result;
        }),
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
    getParamFormality(req, targetLang);
    const glossary = getParamGlossary(req, sourceLang);
    const outputFormat = getParam(req, 'output_format', { lower: true });

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
          const { authKey } = req.user_account;
          const document = await documents.createDocument(file, authKey, targetLang, sourceLang,
            glossary, outputFormat);
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
    const documentKey = getParam(req, 'document_key', { single: true });
    const document = documents.getDocument(req.params.document_id, documentKey, authKey,
      req.session);

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
      res.download(
        document.path_out,
        document.name_out,
        {
          headers: { 'Content-Type': document.contentType },
        },
        (err) => {
          if (err) {
            console.log(`Error occurred during file download: ${err}`);
          } else {
            documents.removeDocument(document);
          }
        },
      );
    }
  } catch {
    res.status(404).send();
  }
}

async function handleV2GlossaryList(req, res) {
  try {
    // Access glossary_id param from path, note: glossary_id is optional, so may be undefined
    const glossaryId = getParamGlossaryId(req, false);
    const { authKey } = req.user_account;

    if (glossaryId !== undefined) {
      const glossaryInfo = glossariesV2.getGlossaryInfo(glossaryId, authKey);
      res.status(200).send(glossaryInfo);
    } else {
      const glossaryList = glossariesV2.getGlossaryInfoList(authKey);
      res.status(200).send({ glossaries: glossaryList });
    }
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleV3GlossaryList(req, res) {
  try {
    // Access glossary_id param from path, note: glossary_id is optional, so may be undefined
    const glossaryId = getParamGlossaryId(req, false);
    const { authKey } = req.user_account;

    if (glossaryId !== undefined) {
      const glossaryInfo = glossariesV3.getGlossaryInfo(glossaryId, authKey);
      res.status(200).send(glossaryInfo);
    } else {
      const glossaryList = glossariesV3.getGlossaryInfoList(authKey);
      res.status(200).send({ glossaries: glossaryList });
    }
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleV2GlossaryEntries(req, res) {
  try {
    if (req.accepts('text/tab-separated-values')) {
      const glossaryId = getParamGlossaryId(req);
      const { authKey } = req.user_account;
      const entries = glossariesV2.getGlossaryEntries(glossaryId, authKey);
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

async function handleV3GlossaryEntries(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    const sourceLang = getParamSourceLang(req);
    const targetLang = getParamTargetLang(req);
    const entries = glossariesV3.getDictionaryEntries(
      glossaryId,
      sourceLang,
      targetLang,
      authKey,
    );
    res.status(200).send(entries);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

function handleGlossaryLanguages(req, res) {
  try {
    res.status(200).send(
      {
        supported_languages: languages.getGlossaryLanguagePairs(),
      },
    );
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send(err.body());
  }
}

async function handleV2GlossaryCreate(req, res) {
  try {
    const { authKey } = req.user_account;

    const name = getParam(req, 'name', {
      required: true,
      newErrorMessage: true,
      validator: (value) => value.length !== 0,
    });
    const targetLang = getParam(req, 'target_lang', {
      upper: true, validator: languages.isGlossaryLanguage,
    });
    const sourceLang = getParam(req, 'source_lang', {
      upper: true, validator: languages.isGlossaryLanguage,
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
    const glossaryInfo = await glossariesV2.createGlossary(name, authKey, targetLang, sourceLang,
      entriesFormat, entries);
    res.status(201).send(glossaryInfo);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send(err.body());
  }
}

async function handleV3GlossaryCreate(req, res) {
  try {
    const { authKey } = req.user_account;

    const name = getParam(req, 'name', {
      required: true,
      newErrorMessage: true,
      validator: (value) => value.length !== 0,
    });
    const glossaryDicts = getParamDictionaries(req);

    const glossaryInfo = await glossariesV3.createGlossary(name, authKey, glossaryDicts);
    res.status(201).send(glossaryInfo);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send(err.body());
  }
}

async function handleV2GlossaryDelete(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    glossariesV2.removeGlossary(glossaryId, authKey);
    res.status(204).send();
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleV3GlossaryDelete(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    glossariesV3.removeGlossary(glossaryId, authKey);
    res.status(204).send();
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleDictionaryDelete(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    const sourceLang = getParamSourceLang(req);
    const targetLang = getParamTargetLang(req);
    glossariesV3.removeDictionary(glossaryId, sourceLang, targetLang, authKey);
    res.status(204).send();
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleGlossaryPatch(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    const name = getParam(req, 'name', {
      required: false,
      newErrorMessage: true,
      validator: (value) => value.length !== 0,
    });
    const glossaryDicts = getParamDictionaries(req, false);

    const glossary = await glossariesV3.patchGlossary(glossaryId, name, glossaryDicts, authKey);
    res.status(200).send(glossary);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

async function handleDictionaryPut(req, res) {
  try {
    const glossaryId = getParamGlossaryId(req);
    const { authKey } = req.user_account;
    const sourceLang = getParamSourceLang(req);
    const targetLang = getParamTargetLang(req);
    const entries = getParam(req, 'entries', { required: true });
    const entriesFormat = getParam(req, 'entries_format', {
      required: true,
      validator: (value) => {
        if (value !== 'tsv' && value !== 'csv') {
          throw new util.HttpError('Unsupported entry format specified', 401);
        }
      },
    });
    const glossary = await glossariesV3.putDictionary(
      glossaryId,
      sourceLang,
      targetLang,
      entries,
      entriesFormat,
      authKey,
    );
    res.status(200).send(glossary);
  } catch (err) {
    console.log(err.message);
    res.status(err.status()).send();
  }
}

app.use('/v2/languages', express.json());
app.get('/v2/languages', auth, requireUserAgent, handleLanguages);
app.post('/v2/languages', auth, requireUserAgent, handleLanguages);

app.use('/v2/usage', express.json());
app.get('/v2/usage', auth, requireUserAgent, handleUsage);
app.post('/v2/usage', auth, requireUserAgent, handleUsage);

app.use('/v2/translate', express.json());
app.get('/v2/translate', auth, requireUserAgent, handleTranslate);
app.post('/v2/translate', auth, requireUserAgent, handleTranslate);

// (internal only) Note that this is not a real endpoint on the DeepL API. It is only included
// to support testing path overrides in the client libraries.
app.use('/v2/translate_secondary', express.json());
app.post('/v2/translate_secondary', auth, requireUserAgent, handleTranslate);

app.use('/v2/write/rephrase', express.json());
app.get('/v2/write/rephrase', auth, requireUserAgent, handleRephrase);
app.post('/v2/write/rephrase', auth, requireUserAgent, handleRephrase);

app.post('/v2/document', auth, requireUserAgent, handleDocument);

app.use('/v2/document/:document_id', express.json());
app.get('/v2/document/:document_id', auth, requireUserAgent, handleDocumentStatus);
app.post('/v2/document/:document_id', auth, requireUserAgent, handleDocumentStatus);

app.use('/v2/document/:document_id/result', express.json());
app.get('/v2/document/:document_id/result', auth, requireUserAgent, handleDocumentDownload);
app.post('/v2/document/:document_id/result', auth, requireUserAgent, handleDocumentDownload);

// Maximum glossary size is 10MiB, but there is some extra request overhead
app.use('/v2/glossaries', express.json({ limit: '11mb' }));
app.get('/v2/glossary-language-pairs', auth, requireUserAgent, handleGlossaryLanguages);
app.post('/v2/glossaries', auth, requireUserAgent, handleV2GlossaryCreate.bind(null));
app.get('/v2/glossaries', auth, requireUserAgent, handleV2GlossaryList.bind(null));
app.get('/v2/glossaries/:glossary_id', auth, requireUserAgent, handleV2GlossaryList.bind(null));
app.get('/v2/glossaries/:glossary_id/entries', auth, requireUserAgent, handleV2GlossaryEntries.bind(null));
app.delete('/v2/glossaries/:glossary_id', auth, requireUserAgent, handleV2GlossaryDelete.bind(null));

// Maximum glossary size is 10MiB, but there is some extra request overhead
app.use('/v3/glossaries', express.json({ limit: '11mb' }));
app.post('/v3/glossaries', auth, requireUserAgent, handleV3GlossaryCreate.bind(null));
app.get('/v3/glossaries', auth, requireUserAgent, handleV3GlossaryList.bind(null));
app.get('/v3/glossaries/:glossary_id', auth, requireUserAgent, handleV3GlossaryList.bind(null));
app.get('/v3/glossaries/:glossary_id/entries', auth, requireUserAgent, handleV3GlossaryEntries.bind(null));
app.delete('/v3/glossaries/:glossary_id', auth, requireUserAgent, handleV3GlossaryDelete.bind(null));
app.delete('/v3/glossaries/:glossary_id/dictionaries', auth, requireUserAgent, handleDictionaryDelete);
app.patch('/v3/glossaries/:glossary_id', auth, requireUserAgent, handleGlossaryPatch);
app.put('/v3/glossaries/:glossary_id/dictionaries', auth, requireUserAgent, handleDictionaryPut);

app.all('/*', (req, res) => {
  res.status(404).send();
});

const server = app.listen(port, () => {
  console.log(`DeepL API mock-server listening on port ${port}`);
}).on('error', (error) => {
  console.error(`Error occurred while starting the server: ${error}`);
  process.exit(1);
});

server.keepAliveTimeout = 10 * 1000;

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
