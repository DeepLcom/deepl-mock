// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const uuid = require('uuid');
const util = require('./util');

const translationMemories = new Map();
const DEFAULT_TM_ID = 'a74d88fb-ed2a-4943-a664-a4512398b994';
util.scheduleCleanup(translationMemories, (tm, tmId) => {
  console.log(`Removing translation memory "${tm.name}" (${tmId})`);
});

function getDefaultTranslationMemory() {
  return {
    translationMemoryId: DEFAULT_TM_ID,
    name: 'Default Translation Memory',
    sourceLanguage: 'DE',
    targetLanguages: ['EN', 'ES', 'FR'],
    segmentCount: 3542,
    used: new Date(),
    authKey: null, // Available to all users
  };
}

function extractTranslationMemoryInfo(tm) {
  return {
    translation_memory_id: tm.translationMemoryId,
    name: tm.name,
    source_language: tm.sourceLanguage,
    target_languages: tm.targetLanguages,
    segment_count: tm.segmentCount,
  };
}

function isValidTranslationMemoryId(tmId) {
  return uuid.validate(tmId);
}

function getTranslationMemory(tmId, authKey) {
  if (tmId === DEFAULT_TM_ID) {
    return getDefaultTranslationMemory();
  }
  const tm = translationMemories.get(tmId);
  if (tm?.authKey === authKey) {
    tm.used = new Date();
    return tm;
  }
  throw new util.HttpError('not found', 404);
}

function getTranslationMemoryInfoList(authKey, page, pageSize) {
  const result = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [, tm] of translationMemories.entries()) {
    if (tm.authKey === authKey) {
      result.push(extractTranslationMemoryInfo(tm));
    }
  }
  const defaultTm = getDefaultTranslationMemory();
  result.push(extractTranslationMemoryInfo(defaultTm));

  // Apply pagination
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedResult = result.slice(startIndex, endIndex);

  return {
    translation_memories: paginatedResult,
    total_count: result.length,
  };
}

module.exports = {
  isValidTranslationMemoryId,
  getTranslationMemory,
  getTranslationMemoryInfoList,
  extractTranslationMemoryInfo,
  getDefaultTranslationMemory,
  DEFAULT_TM_ID,
};
