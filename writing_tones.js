// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const WritingTone = Object.freeze({
  CONFIDENT: 'confident',
  DEFAULT: 'default',
  DIPLOMATIC: 'diplomatic',
  ENTHUSIASTIC: 'enthusiastic',
  FRIENDLY: 'friendly',
  PREFER_CONFIDENT: 'prefer_confident',
  PREFER_DEFAULT: 'prefer_default',
  PREFER_DIPLOMATIC: 'prefer_diplomatic',
  PREFER_ENTHUSIASTIC: 'prefer_enthusiastic',
  PREFER_FRIENDLY: 'prefer_friendly',
});

const writingTones = Object.values(WritingTone);

module.exports = {
  WritingTone,
  writingTones,
};
