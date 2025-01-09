// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const languages = require('./languages');

const writingTones = new Set([
  'confident',
  'default',
  'diplomatic',
  'enthusiastic',
  'friendly',
  'prefer_confident',
  'prefer_diplomatic',
  'prefer_enthusiastic',
  'prefer_friendly',
]);

function isSupportedWritingTone(tone, targetLang) {
  if (tone === undefined) return false;
  const toneLower = tone.toLowerCase();
  return writingTones.has(toneLower) && languages.supportsWritingTone(targetLang, toneLower);
}

module.exports = {
  isSupportedWritingTone,
};
