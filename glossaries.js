// Copyright 2021 DeepL GmbH (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const uuid = require('uuid');
const util = require('./util');

const glossaries = new Map();
util.scheduleCleanup(glossaries, (glossary, glossaryId) => {
  console.log(`Removing glossary "${glossary.name}" (${glossaryId})`);
});

function findEntry(entryList, sourceEntry) {
  for (let i = 0; i < entryList.length; i += 1) {
    if (entryList[i].source === sourceEntry) {
      return entryList[i].target;
    }
  }
  return undefined;
}

function convertListToGlossaryTsv(entriesList) {
  return entriesList.map((value) => `${value.source}\t${value.target}`).join('\n');
}

function convertGlossaryTsvToList(entriesTsv) {
  const entryList = [];
  const entries = entriesTsv.split('\n');
  if (entries.length === 0) {
    throw new util.HttpError('Bad request', 400, 'Missing or invalid argument: entries');
  }
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entryPosition = 0; // TODO Implement calculation of entry positions
    const entry = entries[entryIndex].trim();
    if (entry !== '') {
      const tabPosition = entry.indexOf('\t');
      if (tabPosition === -1) {
        throw new util.HttpError('Invalid glossary entries provided', 400,
          `Key with the index ${entryIndex} (starting at position ${entryPosition}) misses tab separator`);
      }
      const source = entry.substr(0, tabPosition);
      const target = entry.substr(tabPosition + 1);
      if (findEntry(entryList, source) !== undefined) {
        throw new util.HttpError('Invalid glossary entries provided', 400,
          `Key with the index ${entryIndex} (starting at position ${entryPosition}) duplicates key with the index {} (starting at position {})`);
      }
      entryList.push({ source, target });
    }
  }
  return entryList;
}

function extractGlossaryInfo(glossary) {
  return {
    glossary_id: glossary.glossaryId,
    name: glossary.name,
    ready: glossary.ready,
    target_lang: glossary.targetLang,
    source_lang: glossary.sourceLang,
    creation_time: glossary.created.toISOString(),
    entry_count: glossary.entryList.length,
  };
}

function isSupportedLanguagePair(sourceLang, targetLang) {
  const supportedLanguages = ['EN>DE', 'EN>FR', 'EN>ES', 'DE>EN', 'ES>EN', 'FR>EN'];
  return supportedLanguages.includes(`${sourceLang}>${targetLang}`);
}

function isValidGlossaryId(glossaryId) {
  return uuid.validate(glossaryId);
}

function translateWithGlossary(entryList, input) {
  for (let entryIndex = 0; entryIndex < entryList.length; entryIndex += 1) {
    const { source, target } = entryList[entryIndex];
    if (source === input) {
      return target;
    }
  }
  return null;
}

function createGlossary(name, authKey, targetLang, sourceLang, entriesTsv) {
  if (!isSupportedLanguagePair(sourceLang, targetLang)) {
    throw new util.HttpError('Unsupported glossary source and target language pair', 400);
  }

  const entryList = convertGlossaryTsvToList(entriesTsv);
  const glossaryId = uuid.v1();

  // Add glossary to list
  const glossary = {
    glossaryId,
    name,
    created: new Date(),
    used: new Date(),
    ready: true,
    authKey,
    sourceLang,
    targetLang,
    entryList,
    translate: (input) => translateWithGlossary(glossary.entryList, input),
  };
  glossaries.set(glossaryId, glossary);
  console.log(`Created glossary "${glossary.name}" (${glossaryId})`);
  return extractGlossaryInfo(glossary);
}

function getGlossary(glossaryId, authKey) {
  const glossary = glossaries.get(glossaryId);
  if (glossary?.authKey === authKey) {
    glossary.used = new Date();
    return glossary;
  }
  throw new util.HttpError('not found', 404);
}

function getGlossaryInfo(glossaryId, authKey) {
  return extractGlossaryInfo(getGlossary(glossaryId, authKey));
}

function getGlossaryInfoList(authKey) {
  const result = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [, glossary] of glossaries.entries()) {
    if (glossary.authKey === authKey) {
      result.push(extractGlossaryInfo(glossary));
    }
  }
  return result;
}

function getGlossaryEntries(glossaryId, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  return convertListToGlossaryTsv(glossary.entryList);
}

function removeGlossary(glossaryId, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  console.log(`Removing glossary "${glossary.name}" (${glossaryId})`);
  glossaries.delete(glossaryId);
  console.log('Done');
}

module.exports = {
  createGlossary,
  isSupportedLanguagePair,
  isValidGlossaryId,
  getGlossary,
  getGlossaryInfo,
  getGlossaryInfoList,
  getGlossaryEntries,
  removeGlossary,
};
