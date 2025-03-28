// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const uuid = require('uuid');
const csvParser = require('./glossariesCsvParser');
const util = require('./util');
const languages = require('./languages');

const GLOSSARY_ENTRIES_FORMATS = Object.freeze({
  CSV: 'csv',
  TSV: 'tsv',
});

// storing glossaries in memory
const glossaries = new Map();
util.scheduleCleanup(glossaries, (glossary, glossaryId) => {
  console.log(`Removing glossary "${glossary.name}" (${glossaryId})`);
});

function findEntryIndex(entryList, sourceEntry) {
  for (let i = 0; i < entryList.length; i += 1) {
    if (entryList[i].source === sourceEntry) {
      return i;
    }
  }
  return -1;
}

function convertListToGlossaryDictionaryTsv(entriesList) {
  return entriesList.map((value) => `${value.source}\t${value.target}`).join('\n');
}

function convertGlossaryDictionaryTsvToList(entriesTsv) {
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
      const foundIndex = findEntryIndex(entryList, source);
      if (foundIndex !== -1) {
        throw new util.HttpError('Invalid glossary entries provided', 400,
          `Key with the index ${entryIndex} (starting at position ${entryPosition}) duplicates key with the index ${foundIndex} (starting at position {})`);
      }
      entryList.push({ source, target });
    }
  }
  return entryList;
}

function extractDictionaryInfo(glossaryDict) {
  return {
    target_lang: glossaryDict.targetLang.toLowerCase(),
    source_lang: glossaryDict.sourceLang.toLowerCase(),
    entry_count: glossaryDict.entryList.length,
  };
}

function extractGlossaryInfo(glossary) {
  return {
    glossary_id: glossary.glossaryId,
    name: glossary.name,
    dictionaries: glossary.dictionaries.map((glossaryDict) => extractDictionaryInfo(glossaryDict)),
    creation_time: glossary.created.toISOString(),
  };
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

async function createGlossary(name, authKey, dictionaries) {
  if (!Array.isArray(dictionaries) || dictionaries.length === 0) {
    throw new util.HttpError('Glossary dictionaries must be provided', 400);
  }
  const glossaryDictionaries = await Promise.all(dictionaries.map(async (glossaryDict) => {
    if (!languages.isGlossarySupportedLanguagePair(glossaryDict.sourceLang,
      glossaryDict.targetLang)) {
      throw new util.HttpError('Unsupported glossary source and target language pair', 400);
    }

    if (glossaryDict.entriesFormat !== GLOSSARY_ENTRIES_FORMATS.TSV
        && glossaryDict.entriesFormat !== GLOSSARY_ENTRIES_FORMATS.CSV) {
      throw new util.HttpError('Value for entries_format not supported.', 400);
    }

    let entryList;
    if (glossaryDict.entriesFormat === GLOSSARY_ENTRIES_FORMATS.TSV) {
      entryList = convertGlossaryDictionaryTsvToList(glossaryDict.entries);
    } else {
      entryList = await csvParser.convertGlossaryEntriesCsvToList(glossaryDict.entries,
        glossaryDict.sourceLang,
        glossaryDict.targetLang);
    }

    return {
      sourceLang: glossaryDict.sourceLang,
      targetLang: glossaryDict.targetLang,
      entriesFormat: glossaryDict.entriesFormat,
      entryList,
    };
  }));

  const glossaryId = uuid.v1();

  // Add glossary to list
  const glossary = {
    glossaryId,
    name,
    created: new Date(),
    used: new Date(),
    authKey,
    dictionaries: glossaryDictionaries,
    translate: (input, sourceLang, targetLang) => {
      try {
        return translateWithGlossary(
          glossaryDictionaries.find((glossaryDict) => glossaryDict.sourceLang.toUpperCase()
          === languages.getBaseLanguageCode(sourceLang) && glossaryDict.targetLang.toUpperCase()
          === languages.getBaseLanguageCode(targetLang)).entryList, input,
        );
      } catch {
        throw new util.HttpError('Glossary dictionary not found', 404);
      }
    },
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
  throw new util.HttpError('Glossary not found', 404);
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

function getDictionaryEntries(glossaryId, sourceLang, targetLang, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  if (!languages.isGlossarySupportedLanguagePair(sourceLang, targetLang)) {
    throw new util.HttpError('Unsupported glossary source and target language pair', 400);
  }
  const dictionary = glossary.dictionaries.filter((dict) => dict.sourceLang.toUpperCase()
    === sourceLang.toUpperCase() && dict.targetLang.toUpperCase() === targetLang.toUpperCase())[0];
  if (dictionary == null) {
    throw new util.HttpError('Dictionary not found', 404);
  }
  const dictEntries = {
    source_lang: sourceLang,
    target_lang: targetLang,
    entries_format: GLOSSARY_ENTRIES_FORMATS.TSV,
    entries: convertListToGlossaryDictionaryTsv(dictionary.entryList),
  };
  return {
    dictionaries: [dictEntries],
  };
}

function removeGlossary(glossaryId, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  console.log(`Removing glossary "${glossary.name}" (${glossaryId})`);
  glossaries.delete(glossaryId);
  console.log('Done');
}

function removeDictionary(glossaryId, sourceLang, targetLang, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  if (!languages.isGlossarySupportedLanguagePair(sourceLang, targetLang)) {
    throw new util.HttpError('Unsupported glossary source and target language pair', 400);
  }
  const dictionary = glossary.dictionaries.filter((dict) => dict.sourceLang.toUpperCase()
    === sourceLang.toUpperCase() && dict.targetLang.toUpperCase() === targetLang.toUpperCase())[0];
  if (dictionary == null) {
    throw new util.HttpError('Dictionary not found', 404);
  }
  const glossaryDictsToKeep = glossary.dictionaries.filter((dict) => dict.sourceLang.toUpperCase()
    !== sourceLang.toUpperCase() && dict.targetLang.toUpperCase() !== targetLang.toUpperCase());
  console.log(`Removing dictionary for source language ${dictionary.sourceLang} and target `
    + `language ${dictionary.targetLang} in glossary "${glossary.name}" (${glossaryId})`);
  glossary.dictionaries = glossaryDictsToKeep;
  console.log('Done');
}

async function patchGlossary(glossaryId, name, dictionaries, authKey) {
  const glossary = getGlossary(glossaryId, authKey);
  if (name) {
    glossary.name = name;
  }
  if (dictionaries.length > 1) {
    throw new util.HttpError('Not implemented yet: only dictionaries of length 0 or 1 is currently supported', 400);
  }
  if (dictionaries.length === 1) {
    const glossaryDict = dictionaries[0];
    if (!glossaryDict.entriesFormat) {
      throw new util.HttpError('Entries format for dictionary is required');
    }
    if (!glossaryDict.sourceLang) {
      throw new util.HttpError('Source language for dictionary is required');
    }
    if (!glossaryDict.targetLang) {
      throw new util.HttpError('Target language for dictionary is required');
    }
    const glossaryDictsToKeep = glossary.dictionaries.filter((dict) => dict.sourceLang
      !== glossaryDict.sourceLang && dict.targetLang !== glossaryDict.targetLang);

    let entryList;
    if (glossaryDict.entriesFormat === GLOSSARY_ENTRIES_FORMATS.TSV) {
      entryList = convertGlossaryDictionaryTsvToList(glossaryDict.entries);
    } else {
      entryList = await csvParser.convertGlossaryEntriesCsvToList(glossaryDict.entries,
        glossaryDict.sourceLang,
        glossaryDict.targetLang);
    }

    glossaryDictsToKeep.push({
      sourceLang: glossaryDict.sourceLang,
      targetLang: glossaryDict.targetLang,
      entriesFormat: glossaryDict.entriesFormat,
      entryList,
    });
    glossary.dictionaries = glossaryDictsToKeep;
  }
  const glossaryInfo = getGlossaryInfo(glossaryId, authKey);
  return glossaryInfo;
}

async function putDictionary(glossaryId, sourceLang, targetLang, entries, entriesFormat, authKey) {
  const glossary = getGlossary(glossaryId, authKey);

  if (!languages.isGlossarySupportedLanguagePair(sourceLang, targetLang)) {
    throw new util.HttpError('Unsupported glossary source and target language pair', 400);
  }

  let entryList;
  if (entriesFormat === GLOSSARY_ENTRIES_FORMATS.TSV) {
    entryList = convertGlossaryDictionaryTsvToList(entries);
  } else {
    entryList = await csvParser.convertGlossaryEntriesCsvToList(entries, sourceLang, targetLang);
  }

  const glossaryDictsToKeep = glossary.dictionaries.filter((dict) => dict.sourceLang
    !== sourceLang && dict.targetLang !== targetLang);

  const updatedGlossaryDict = {
    sourceLang,
    targetLang,
    entriesFormat,
    entryList,
  };
  glossaryDictsToKeep.push(updatedGlossaryDict);
  glossary.dictionaries = glossaryDictsToKeep;
  return extractDictionaryInfo(updatedGlossaryDict);
}

module.exports = {
  createGlossary,
  isValidGlossaryId,
  getGlossary,
  getGlossaryInfo,
  getGlossaryInfoList,
  getDictionaryEntries,
  removeGlossary,
  removeDictionary,
  patchGlossary,
  putDictionary,
};
