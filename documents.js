// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const fs = require('fs');
const path = require('path');
const languages = require('./languages');
const util = require('./util');

function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    // ignore
  }
}

const documents = new Map();
util.scheduleCleanup(documents, (document, id) => {
  if (document.pathIn) {
    try {
      fs.unlinkSync(document.pathIn);
    } catch (err) {
      // ignore
    }
  }
  if (document.path_out) {
    deleteFile(document.path_out);
  }
  console.log('Removed document:', id);
});

function generateRandomHexString(length) {
  const hex = '0123456789ABCDEF';
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += hex.charAt(Math.floor(Math.random() * 16));
  }
  return output;
}

async function createDocument(file, authKey, targetLang, sourceLang, glossary) {
  const extname = path.extname(file.name).toLowerCase();

  if (!(['.txt', '.docx', '.pptx', '.htm', '.html'].includes(extname))) {
    throw new util.HttpError('Invalid file data.', 400);
  }
  if (extname !== '.txt') {
    throw new util.HttpError('Mock server only implements document translation for .txt files.', 503);
  }
  if (targetLang === sourceLang) {
    throw new util.HttpError('Source and target language are equal.', 400);
  }

  // Generate id & key for document
  const documentId = generateRandomHexString(32);
  const documentKey = generateRandomHexString(64);
  const pathIn = `./documents/${documentId}`;

  await file.mv(pathIn);

  // Add document to list
  const document = {
    id: documentId,
    key: documentKey,
    pathIn,
    path_out: undefined,
    name: file.name,
    mimetype: file.mimetype,
    created: new Date(),
    used: new Date(),
    authKey,
    source_lang: sourceLang,
    target_lang: targetLang,
    glossary,
    // Mock server simplification: billed characters assumed to be file size
    billed_characters: file.size,
    status: 'queued',
    seconds_remaining: undefined,
    error: undefined,
  };
  documents.set(documentId, document);
  console.log(`Storing document ${documentId} (key: ${documentKey})`);
  return document;
}

function getDocument(documentId, documentKey, authKey, session) {
  const document = documents.get(documentId);
  if (document?.key === documentKey && document.authKey === authKey) {
    const queuedUntil = session?.doc_queue_time || 0;
    const translatingUntil = (session?.doc_translate_time || 0) + queuedUntil;
    document.used = new Date();
    const age = document.used - document.created;
    if (document.error) {
      document.status = 'error';
      document.error_message = document.error;
    } else if (age < queuedUntil) {
      document.status = 'queued';
    } else if (age < translatingUntil || document.path_out === undefined) {
      document.status = 'translating';
      document.seconds_remaining = Math.round(Math.max(translatingUntil - age, 0) / 1000);
    } else {
      document.status = 'done';
      document.seconds_remaining = 0;
    }

    return document;
  }
  throw new util.HttpError('not found', 404);
}

async function translateDocument(document, session) {
  /* eslint-disable no-param-reassign */
  // Note: this function may modify the document and session arguments
  //   session failed document will be checked and decremented if active.
  //   document will be modified with the translation result.
  const { pathIn } = document;
  const pathOut = `${pathIn}.result`;
  if (session?.doc_failure > 0) {
    session.doc_failure -= 1;
    document.error = 'Translation error triggered';
    console.log(`Failing translation of ${pathIn}`);
  } else {
    const textIn = fs.readFileSync(pathIn, 'utf8');
    const translateResult = languages.translate(textIn, document.target_lang, document.source_lang,
      document.glossary);
    const detectedSourceLang = translateResult.detected_source_language;
    if (document.target_lang === detectedSourceLang) {
      document.error = 'Source and target language are equal.';
      console.log(`Error translating ${pathIn} to ${document.target_lang}: ${document.error}`);
    } else {
      fs.writeFileSync(pathOut, translateResult.text);
      document.path_out = pathOut;
      console.log(`Translated ${pathIn} to ${document.target_lang}, stored result at ${pathOut}`);
    }
  }
  console.log(`Removing input document ${pathIn}`);
  deleteFile(pathIn);
  /* eslint-enable no-param-reassign */
}

function removeDocument(document) {
  console.log(`Removing output document ${document.path_out}`);
  deleteFile(document.path_out);

  documents.delete(document.id);
}

module.exports = {
  createDocument, getDocument, translateDocument, removeDocument,
};
