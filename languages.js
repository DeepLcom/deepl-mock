// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const languages = new Map([
  ['AF', { name: 'Afrikaans', type: 'both', text: 'protoonstraal' }],
  ['AN', { name: 'Aragonese', type: 'both', text: 'feixe de protons' }],
  ['AR', { name: 'Arabic', type: 'both', text: 'شعاع البروتون' }],
  ['AS', { name: 'Assamese', type: 'both', text: 'প্ৰোটন ৰশ্মি' }],
  ['AY', { name: 'Aymara', type: 'both', text: 'hayu proton' }],
  ['AZ', { name: 'Azerbaijani', type: 'both', text: 'proton şüası' }],
  ['BA', { name: 'Bashkir', type: 'both', text: 'протон нуры' }],
  ['BE', { name: 'Belarusian', type: 'both', text: 'пратонны пучок' }],
  ['BG', { name: 'Bulgarian', type: 'both', text: 'протонен лъч' }],
  ['BN', { name: 'Bengali', type: 'both', text: 'প্রোটন রশ্মি' }],
  ['BR', { name: 'Breton', type: 'both', text: 'takad proton' }],
  ['BS', { name: 'Bosnian', type: 'both', text: 'protonski zrak' }],
  ['CA', { name: 'Catalan', type: 'both', text: 'feix de protons' }],
  ['CS', { name: 'Czech', type: 'both', text: 'protonový paprsek' }],
  ['CY', { name: 'Welsh', type: 'both', text: 'pelydryn proton' }],
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
  ['EO', { name: 'Esperanto', type: 'both', text: 'protona radio' }],
  ['ES', {
    name: 'Spanish',
    type: 'both',
    formality: true,
    text: 'haz de protones',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['ES-419', {
    name: 'Spanish (Latin American)', type: 'target', formality: true, text: 'haz de protones',
  }],
  ['ET', { name: 'Estonian', type: 'both', text: 'prootonikiirgus' }],
  ['EU', { name: 'Basque', type: 'both', text: 'protoi izpia' }],
  ['FA', { name: 'Persian', type: 'both', text: 'پرتو پروتون' }],
  ['FI', { name: 'Finnish', type: 'both', text: 'protonisäde' }],
  ['FR', {
    name: 'French',
    type: 'both',
    formality: true,
    text: 'faisceau de protons',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['GA', { name: 'Irish', type: 'both', text: 'léas prótóin' }],
  ['GL', { name: 'Galician', type: 'both', text: 'feixe de prótons' }],
  ['GN', { name: 'Guarani', type: 'both', text: "proton ra'anga" }],
  ['GU', { name: 'Gujarati', type: 'both', text: 'પ્રોટોન બીમ' }],
  ['HA', { name: 'Hausa', type: 'both', text: 'hasken proton' }],
  ['HE', { name: 'Hebrew', type: 'both', text: 'קרן פרוטון' }],
  ['HI', { name: 'Hindi', type: 'both', text: 'प्रोटॉन किरण' }],
  ['HR', { name: 'Croatian', type: 'both', text: 'protonska zraka' }],
  ['HT', { name: 'Haitian Creole', type: 'both', text: 'reyon pwotòn' }],
  ['HU', { name: 'Hungarian', type: 'both', text: 'protonnyaláb' }],
  ['HY', { name: 'Armenian', type: 'both', text: 'պրոտոնային փնջ' }],
  ['ID', { name: 'Indonesian', type: 'both', text: 'berkas proton' }],
  ['IG', { name: 'Igbo', type: 'both', text: 'wiwe proton' }],
  ['IS', { name: 'Icelandic', type: 'both', text: 'prótóngeisli' }],
  ['IT', {
    name: 'Italian',
    type: 'both',
    formality: true,
    text: 'fascio di protoni',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['JA', {
    name: 'Japanese', type: 'both', formality: true, text: '陽子ビーム', supports_write: true,
  }],
  ['JV', { name: 'Javanese', type: 'both', text: 'sinar proton' }],
  ['KA', { name: 'Georgian', type: 'both', text: 'პროტონის სხივი' }],
  ['KK', { name: 'Kazakh', type: 'both', text: 'протон сәулесі' }],
  ['KO', {
    name: 'Korean', type: 'both', text: '양성자 빔', supports_write: true,
  }],
  ['KY', { name: 'Kyrgyz', type: 'both', text: 'протон нуру' }],
  ['LA', { name: 'Latin', type: 'both', text: 'radius protonicus' }],
  ['LB', { name: 'Luxembourgish', type: 'both', text: 'Protonestral' }],
  ['LN', { name: 'Lingala', type: 'both', text: 'moyi wa proton' }],
  ['LT', { name: 'Lithuanian', type: 'both', text: 'protonų spindulys' }],
  ['LV', { name: 'Latvian', type: 'both', text: 'protonu staru kūlis' }],
  ['MG', { name: 'Malagasy', type: 'both', text: 'taratra proton' }],
  ['MI', { name: 'Maori', type: 'both', text: 'hihi proton' }],
  ['MK', { name: 'Macedonian', type: 'both', text: 'протонски зрак' }],
  ['ML', { name: 'Malayalam', type: 'both', text: 'പ്രോടോൺ ബീം' }],
  ['MN', { name: 'Mongolian', type: 'both', text: 'протоны туяа' }],
  ['MR', { name: 'Marathi', type: 'both', text: 'प्रोटॉन किरण' }],
  ['MS', { name: 'Malay', type: 'both', text: 'alur proton' }],
  ['MT', { name: 'Maltese', type: 'both', text: 'raġġ tal-proton' }],
  ['MY', { name: 'Burmese', type: 'both', text: 'ပရိုတွန်ဓာတ်ရောင်ခြည်' }],
  ['NB', { name: 'Norwegian (bokmål)', type: 'both', text: 'protonstråle' }],
  ['NE', { name: 'Nepali', type: 'both', text: 'प्रोटन किरण' }],
  ['NL', {
    name: 'Dutch', type: 'both', formality: true, text: 'protonenbundel',
  }],
  ['OC', { name: 'Occitan', type: 'both', text: 'fais de protons' }],
  ['OM', { name: 'Oromo', type: 'both', text: 'ifaa proton' }],
  ['PA', { name: 'Punjabi', type: 'both', text: 'ਪ੍ਰੋਟੋਨ ਬੀਮ' }],
  ['PL', {
    name: 'Polish', type: 'both', formality: true, text: 'wiązka protonów',
  }],
  ['PS', { name: 'Pashto', type: 'both', text: 'د پروتون وړانګه' }],
  ['PT', {
    name: 'Portuguese',
    type: 'source',
    text: 'feixe de prótons',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['PT-BR', {
    name: 'Portuguese (Brazilian)',
    type: 'target',
    formality: true,
    text: 'feixe de prótons',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['PT-PT', {
    name: 'Portuguese (European)',
    type: 'target',
    formality: true,
    text: 'feixe de prótons',
    supports_write: true,
    supports_style: true,
    supports_tone: true,
  }],
  ['QU', { name: 'Quechua', type: 'both', text: "proton k'anchay" }],
  ['RO', { name: 'Romanian', type: 'both', text: 'fascicul de protoni' }],
  ['RU', {
    name: 'Russian', type: 'both', formality: true, text: 'протонный луч',
  }],
  ['SA', { name: 'Sanskrit', type: 'both', text: 'प्रोटॉन रश्मि' }],
  ['SK', { name: 'Slovak', type: 'both', text: 'protónový lúč' }],
  ['SL', { name: 'Slovenian', type: 'both', text: 'protonski žarek' }],
  ['SQ', { name: 'Albanian', type: 'both', text: 'reze protonesh' }],
  ['SR', { name: 'Serbian', type: 'both', text: 'протонски зрак' }],
  ['ST', { name: 'Sesotho', type: 'both', text: 'molapo wa proton' }],
  ['SU', { name: 'Sundanese', type: 'both', text: 'sinar proton' }],
  ['SV', { name: 'Swedish', type: 'both', text: 'protonstråle' }],
  ['SW', { name: 'Swahili', type: 'both', text: 'mwale wa protoni' }],
  ['TA', { name: 'Tamil', type: 'both', text: 'புரோட்டான் கதிர்' }],
  ['TE', { name: 'Telugu', type: 'both', text: 'ప్రోటాన్ కిరణం' }],
  ['TG', { name: 'Tajik', type: 'both', text: 'нури протон' }],
  ['TH', { name: 'Thai', type: 'both', text: 'ลำแสงโปรตอน' }],
  ['TK', { name: 'Turkmen', type: 'both', text: 'proton şöhlesi' }],
  ['TL', { name: 'Tagalog', type: 'both', text: 'sinag ng proton' }],
  ['TN', { name: 'Tswana', type: 'both', text: 'molapo wa proton' }],
  ['TR', { name: 'Turkish', type: 'both', text: 'proton ışını' }],
  ['TS', { name: 'Tsonga', type: 'both', text: 'rivelo ra proton' }],
  ['TT', { name: 'Tatar', type: 'both', text: 'протон нуры' }],
  ['UK', { name: 'Ukrainian', type: 'both', text: 'протонний пучок' }],
  ['UR', { name: 'Urdu', type: 'both', text: 'پروٹون شعاع' }],
  ['UZ', { name: 'Uzbek', type: 'both', text: 'proton nuri' }],
  ['VI', { name: 'Vietnamese', type: 'both', text: 'chùm proton' }],
  ['WO', { name: 'Wolof', type: 'both', text: 'rayon proton' }],
  ['XH', { name: 'Xhosa', type: 'both', text: 'umtya we-proton' }],
  ['YI', { name: 'Yiddish', type: 'both', text: 'פּראָטאָן שטראַל' }],
  ['ZH', {
    source_name: 'Chinese', target_name: 'Chinese (simplified)', type: 'both', text: '质子束', supports_write: true,
  }],
  ['ZH-HANS', {
    name: 'Chinese (simplified)', type: 'target', text: '质子束', supports_write: true,
  }],
  ['ZH-HANT', { name: 'Chinese (traditional)', type: 'target', text: '質子束' }],
  ['ZU', { name: 'Zulu', type: 'both', text: 'umcibisholo we-proton' }],
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
  if (sourceLang === undefined || targetLang === undefined) return false;
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
  if (langCode.toUpperCase() === 'ZH-HANS' || langCode.toUpperCase() === 'ZH-HANT') return 'ZH';
  if (langCode.toUpperCase() === 'ES-419') return 'ES';
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
