// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const languages = require('./languages');

const writingStyles = new Set([
  'academic',
  'business',
  'casual',
  'default',
  'prefer_academic',
  'prefer_business',
  'prefer_casual',
  'prefer_simple',
  'simple',
]);

function isSupportedWritingStyle(style, targetLang) {
  if (style === undefined) return false;
  const styleLower = style.toLowerCase();
  return writingStyles.has(styleLower) && languages.supportsWritingStyle(targetLang, styleLower);
}

module.exports = {
  isSupportedWritingStyle,
};
