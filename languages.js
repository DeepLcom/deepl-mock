// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const languages = new Map([
  ['AR', { name: 'Arabic', type: 'both', text: 'شعاع البروتون' }],
  ['BG', { name: 'Bulgarian', type: 'both', text: 'протонен лъч' }],
  ['CS', { name: 'Czech', type: 'both', text: 'protonový paprsek' }],
  ['DA', { name: 'Danish', type: 'both', text: 'protonstråle' }],
  ['DE', {
    name: 'German',
    type: 'both',
    formality: true,
    text: 'Protonenstrahl',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['EL', { name: 'Greek', type: 'both', text: 'δέσμη πρωτονίων' }],
  ['EN', {
    name: 'English',
    type: 'source',
    text: 'proton beam',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['EN-GB', {
    name: 'English (British)',
    type: 'target',
    text: 'proton beam',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['EN-US', {
    name: 'English (American)',
    type: 'target',
    text: 'proton beam',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['ES', {
    name: 'Spanish',
    type: 'both',
    formality: true,
    text: 'haz de protones',
    supports_write: true,
  }],
  ['ET', { name: 'Estonian', type: 'both', text: 'prootonikiirgus' }],
  ['FI', { name: 'Finnish', type: 'both', text: 'protonisäde' }],
  ['FR', {
    name: 'French',
    type: 'both',
    formality: true,
    text: 'faisceau de protons',
    supports_write: true,
  }],
  ['HU', { name: 'Hungarian', type: 'both', text: 'protonnyaláb' }],
  ['ID', { name: 'Indonesian', type: 'both', text: 'berkas proton' }],
  ['IT', {
    name: 'Italian',
    type: 'both',
    formality: true,
    text: 'fascio di protoni',
    supports_write: true,
  }],
  ['JA', {
    name: 'Japanese', type: 'both', formality: true, text: '陽子ビーム',
  }],
  ['KO', { name: 'Korean', type: 'both', text: '양성자 빔' }],
  ['LT', { name: 'Lithuanian', type: 'both', text: 'protonų spindulys' }],
  ['LV', { name: 'Latvian', type: 'both', text: 'protonu staru kūlis' }],
  ['NB', { name: 'Norwegian (bokmål)', type: 'both', text: 'protonstråle' }],
  ['NL', {
    name: 'Dutch', type: 'both', formality: true, text: 'protonenbundel',
  }],
  ['PL', {
    name: 'Polish', type: 'both', formality: true, text: 'wiązka protonów',
  }],
  ['PT', {
    name: 'Portuguese', type: 'source', text: 'feixe de prótons', supports_write: true,
  }],
  ['PT-BR', {
    name: 'Portuguese (Brazilian)',
    type: 'target',
    formality: true,
    text: 'feixe de prótons',
    supports_write: true,
  }],
  ['PT-PT', {
    name: 'Portuguese (European)',
    type: 'target',
    formality: true,
    text: 'feixe de prótons',
    supports_write: true,
  }],
  ['RO', { name: 'Romanian', type: 'both', text: 'fascicul de protoni' }],
  ['RU', {
    name: 'Russian', type: 'both', formality: true, text: 'протонный луч',
  }],
  ['SK', { name: 'Slovak', type: 'both', text: 'protónový lúč' }],
  ['SL', { name: 'Slovenian', type: 'both', text: 'protonski žarek' }],
  ['SV', { name: 'Swedish', type: 'both', text: 'protonstråle' }],
  ['TR', { name: 'Turkish', type: 'both', text: 'proton ışını' }],
  ['UK', { name: 'Ukrainian', type: 'both', text: 'протонний пучок' }],
  ['ZH', {
    source_name: 'Chinese', target_name: 'Chinese (simplified)', type: 'both', text: '质子束',
  }],
]);

const glossaryLanguages = ['da', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nb', 'nl', 'pl', 'pt', 'ru', 'sv', 'zh'];
const glossaryLanguagePairs = glossaryLanguages.flatMap(
  (source) => glossaryLanguages.map(
    (target) => ((source === target) ? null : {
      source_lang: source,
      target_lang: target,
    }),
  ),
).filter((p) => p);

function getLanguageName(langCode) {
  if (langCode === undefined) return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.get(langCodeUpper)?.name;
}

function isSourceLanguage(langCode) {
  // Unspecified source_lang parameter activates auto-detect
  if (langCode === undefined) return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && ['source', 'both'].includes(languages.get(langCodeUpper).type);
}

function isTargetLanguage(langCode) {
  if (langCode === undefined) return false;
  const langCodeUpper = langCode.toUpperCase();
  if (langCodeUpper === 'EN' || langCodeUpper === 'PT') {
    // Hack to emulate default variants being chosen in real API.
    return true;
  }
  return languages.has(langCodeUpper) && ['target', 'both'].includes(languages.get(langCodeUpper).type);
}

function isGlossaryLanguage(langCode) {
  if (langCode === undefined) return false;
  const langCodeLower = langCode.toLowerCase();
  return glossaryLanguages.includes(langCodeLower);
}

function isGlossarySupportedLanguagePair(sourceLang, targetLang) {
  return glossaryLanguages.includes(sourceLang.toLowerCase())
      && glossaryLanguages.includes(targetLang.toLowerCase());
}

function supportsFormality(langCode, formality) {
  if (langCode === undefined) return false;
  if (formality === 'default') return true;
  if (formality !== undefined && formality.startsWith('prefer_')) return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && languages.get(langCodeUpper).formality !== undefined;
}

function supportsWrite(langCode) {
  if (langCode === undefined) return false;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && languages.get(langCodeUpper).supports_write === true;
}

function supportsWritingStyle(langCode, style) {
  if (langCode === undefined) return false;
  if (style.startsWith('prefer_') || style === 'default') return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && languages.get(langCodeUpper).supports_style === true;
}

function supportsWritingTone(langCode, tone) {
  if (langCode === undefined) return false;
  if (tone.startsWith('prefer_') || tone === 'default') return true;
  const langCodeUpper = langCode.toUpperCase();
  return languages.has(langCodeUpper) && languages.get(langCodeUpper).supports_tone === true;
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

function getGlossaryLanguagePairs() {
  return glossaryLanguagePairs;
}

function getBaseLanguageCode(langCode) {
  if (langCode.toUpperCase() === 'EN-GB' || langCode.toUpperCase() === 'EN-US') return 'EN';
  if (langCode.toUpperCase() === 'PT-BR' || langCode.toUpperCase() === 'PT-PT') return 'PT';
  return langCode;
}

function translateLine(input, sourceLang, targetLang, glossary) {
  if (input === '') return '';

  if (glossary) {
    const glossaryResult = glossary.translate(input, sourceLang, targetLang);
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
  const text = input.split('\n').map((line) => (translateLine(line, sourceLang, targetLang, glossary))).join('\n');

  const textShort = text.length < 50 ? text : `${text.slice(0, 47)}...`;
  const inputShort = input.length < 50 ? input : `${input.slice(0, 47)}...`;
  console.log(`Translated "${inputShort}" to "${textShort}"`);
  return { detected_source_language: sourceLang, text };
}

function rephrase(_, targetLang) {
  return {
    text: languages.get(targetLang.toUpperCase()).text,
    detected_source_language: targetLang.split('-')[0],
    target_language: targetLang,
  };
}

module.exports = {
  getLanguageName,
  isGlossaryLanguage,
  isSourceLanguage,
  getSourceLanguages,
  isTargetLanguage,
  supportsFormality,
  supportsWrite,
  supportsWritingStyle,
  supportsWritingTone,
  getTargetLanguages,
  getGlossaryLanguagePairs,
  getBaseLanguageCode,
  isGlossarySupportedLanguagePair,
  translate,
  rephrase,
};
