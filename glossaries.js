// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const uuid = require('uuid');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const util = require('./util');

const glossaries = new Map();
util.scheduleCleanup(glossaries, (glossary, glossaryId) => {
  console.log(`Removing glossary "${glossary.name}" (${glossaryId})`);
});

const supportedLanguagesList = ['de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pl', 'pt', 'ru', 'zh'];

const supportedLanguages = (() => {
  const result = [];
  for (let i = 0; i < supportedLanguagesList.length; i += 1) {
    for (let j = 0; j < supportedLanguagesList.length; j += 1) {
      if (i !== j) {
        const sourceLang = supportedLanguagesList[i];
        const targetLang = supportedLanguagesList[j];
        result.push({ source_lang: sourceLang, target_lang: targetLang });
      }
    }
  }
  return result;
})();

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

function convertGlossaryCsvToList(entriesCsv, glossarySourceLang, glossaryTargetLang) {
  if (entriesCsv.length === 0) {
    throw new util.HttpError('Bad request', 400, 'Missing or invalid argument: entries');
  }

  return new Promise(((resolve, reject) => {
    const readable = Readable.from([entriesCsv]);
    const results = [];
    readable.pipe(csvParser({ headers: false }))
      .on('data', (data) => {
        const sourceEntry = data[0];
        const targetEntry = data[1];
        const sourceLang = data[2];
        const targetLang = data[3];
        // Ignore empty lines
        if (sourceEntry === undefined || targetEntry === undefined) return;
        // Ignore lines where the source lang or target lang do not match glossary lang
        if (sourceLang !== undefined && targetLang !== undefined
                    && sourceLang.toUpperCase() !== glossarySourceLang
                    && targetLang.toUpperCase() !== glossaryTargetLang) return;
        results.push({ source: sourceEntry, target: targetEntry });
      })
      .on('end', () => {
        if (results.length === 0) {
          return reject(new util.HttpError('Invalid glossary entries provided', 400));
        }
        return resolve(results);
      })
      .on('error', (err) => reject(err));
  }));
}

function extractGlossaryInfo(glossary) {
  return {
    glossary_id: glossary.glossaryId,
    name: glossary.name,
    ready: glossary.ready,
    target_lang: glossary.targetLang.toLowerCase(),
    source_lang: glossary.sourceLang.toLowerCase(),
    creation_time: glossary.created.toISOString(),
    entry_count: glossary.entryList.length,
  };
}

function isSupportedLanguagePair(sourceLang, targetLang) {
  const matchingLanguagesCount = supportedLanguages.filter(
    (glossary) => glossary.source_lang.toUpperCase() === sourceLang
        && glossary.target_lang.toUpperCase() === targetLang,
  ).length;
  return (matchingLanguagesCount > 0);
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

async function createGlossary(name, authKey, targetLang, sourceLang, entriesFormat, entries) {
  if (!isSupportedLanguagePair(sourceLang, targetLang)) {
    throw new util.HttpError('Unsupported glossary source and target language pair', 400);
  }

  let entryList;
  if (entriesFormat === 'tsv') {
    entryList = convertGlossaryTsvToList(entries);
  } else {
    entryList = await convertGlossaryCsvToList(entries, sourceLang, targetLang);
  }
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
  isValidGlossaryId,
  getGlossary,
  getGlossaryInfo,
  getGlossaryInfoList,
  getGlossaryEntries,
  removeGlossary,
  supportedLanguages,
};
