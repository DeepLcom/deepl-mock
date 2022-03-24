// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const languages = new Map([
  ['BG', { name: 'Bulgarian', type: 'both', text: 'протонен лъч' }],
  ['CS', { name: 'Czech', type: 'both', text: 'protonový paprsek' }],
  ['DA', { name: 'Danish', type: 'both', text: 'protonstråle' }],
  ['DE', {
    name: 'German', type: 'both', formality: true, text: 'Protonenstrahl',
  }],
  ['EL', { name: 'Greek', type: 'both', text: 'δέσμη πρωτονίων' }],
  ['EN', { name: 'English', type: 'source', text: 'proton beam' }],
  ['EN-GB', { name: 'English (British)', type: 'target', text: 'proton beam' }],
  ['EN-US', { name: 'English (American)', type: 'target', text: 'proton beam' }],
  ['ES', {
    name: 'Spanish', type: 'both', formality: true, text: 'haz de protones',
  }],
  ['ET', { name: 'Estonian', type: 'both', text: 'prootonikiirgus' }],
  ['FI', { name: 'Finnish', type: 'both', text: 'protonisäde' }],
  ['FR', {
    name: 'French', type: 'both', formality: true, text: 'faisceau de protons',
  }],
  ['HU', { name: 'Hungarian', type: 'both', text: 'protonnyaláb' }],
  ['IT', {
    name: 'Italian', type: 'both', formality: true, text: 'fascio di protoni',
  }],
  ['JA', { name: 'Japanese', type: 'both', text: '陽子ビーム' }],
  ['LT', { name: 'Lithuanian', type: 'both', text: 'protonų spindulys' }],
  ['LV', { name: 'Latvian', type: 'both', text: 'protonu staru kūlis' }],
  ['NL', {
    name: 'Dutch', type: 'both', formality: true, text: 'protonenbundel',
  }],
  ['PL', {
    name: 'Polish', type: 'both', formality: true, text: 'wiązka protonów',
  }],
  ['PT', { name: 'Portuguese', type: 'source', text: 'feixe de prótons' }],
  ['PT-BR', {
    name: 'Portuguese (Brazilian)', type: 'target', formality: true, text: 'feixe de prótons',
  }],
  ['PT-PT', {
    name: 'Portuguese (European)', type: 'target', formality: true, text: 'feixe de prótons',
  }],
  ['RO', { name: 'Romanian', type: 'both', text: 'fascicul de protoni' }],
  ['RU', {
    name: 'Russian', type: 'both', formality: true, text: 'протонный луч',
  }],
  ['SK', { name: 'Slovak', type: 'both', text: 'protónový lúč' }],
  ['SL', { name: 'Slovenian', type: 'both', text: 'protonski žarek' }],
  ['SV', { name: 'Swedish', type: 'both', text: 'protonstråle' }],
  ['ZH', {
    source_name: 'Chinese', target_name: 'Chinese (simplified)', type: 'both', text: '质子束',
  }],
]);

function isSourceLanguage(langCode) {
  // Unspecified source_lang parameter activates auto-detect
  if (langCode === undefined) return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && ['source', 'both'].includes(languages.get(langCodeUpper).type);
}

function isTargetLanguage(langCode) {
  if (langCode === undefined) return false;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && ['target', 'both'].includes(languages.get(langCodeUpper).type);
}

function isGlossaryLanguage(langCode) {
  const langCodeUpper = langCode.toUpperCase();
  return ['EN', 'DE', 'FR', 'ES'].includes(langCodeUpper);
}

function supportsFormality(langCode) {
  if (langCode === undefined) return false;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && languages.get(langCodeUpper).formality !== undefined;
}

function getSourceLanguages() {
  const sourceLanguages = [];
  languages.forEach((lang, code) => {
    if (['source', 'both'].includes(lang.type)) {
      sourceLanguages.push({
        language: code,
        name: lang.source_name ?? lang.name,
      });
    }
  });
  return sourceLanguages;
}

function getTargetLanguages() {
  const targetLanguages = [];
  languages.forEach((lang, code) => {
    if (['target', 'both'].includes(lang.type)) {
      targetLanguages.push({
        language: code,
        name: lang.target_name ?? lang.name,
        supports_formality: Boolean(lang.formality),
      });
    }
  });
  return targetLanguages;
}

function translateLine(input, targetLang, glossary) {
  if (input === '') return '';

  if (glossary) {
    const glossaryResult = glossary.translate(input);
    if (glossaryResult) return glossaryResult;
  }

  // Mock server simplification: each input text is translated to a fixed text for the target
  // language
  return languages.get(targetLang).text;
}

function translate(input, targetLang, sourceLangIn, glossary) {
  let sourceLang = sourceLangIn;
  if (!sourceLang && glossary === undefined) {
    // Mock server simplification: if sourceLang undefined and no test-string match, assume
    // source text is English
    sourceLang = 'EN';
    // eslint-disable-next-line no-restricted-syntax
    for (const [code, lang] of languages.entries()) {
      if (input.startsWith(lang.text)) {
        sourceLang = code;
        break;
      }
    }
  }

  // Split into lines and translate individually
  const text = input.split('\n').map((line) => (translateLine(line, targetLang, glossary))).join('\n');

  const textShort = text.length < 50 ? text : `${text.slice(0, 47)}...`;
  const inputShort = input.length < 50 ? input : `${input.slice(0, 47)}...`;
  console.log(`Translated "${inputShort}" to "${textShort}"`);
  return { detected_source_language: sourceLang, text };
}

module.exports = {
  isGlossaryLanguage,
  isSourceLanguage,
  getSourceLanguages,
  isTargetLanguage,
  supportsFormality,
  getTargetLanguages,
  translate,
};
