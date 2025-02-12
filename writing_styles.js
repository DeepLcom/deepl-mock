// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const WritingStyle = Object.freeze({
  ACADEMIC: 'academic',
  BUSINESS: 'business',
  CASUAL: 'casual',
  SIMPLE: 'simple',
  DEFAULT: 'default',
  PREFER_ACADEMIC: 'prefer_academic',
  PREFER_BUSINESS: 'prefer_business',
  PREFER_CASUAL: 'prefer_casual',
  PREFER_SIMPLE: 'prefer_simple',
  PREFER_DEFAULT: 'prefer_default',
});

const writingStyles = Object.values(WritingStyle);

module.exports = {
  WritingStyle,
  writingStyles,
};
