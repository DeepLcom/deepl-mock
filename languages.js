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
  ['ZH', { name: 'Chinese', type: 'both', text: '质子束' }],
]);

function isSourceLanguage(lang_code) {
  if (lang_code === undefined) return true;
  lang_code = lang_code.toUpperCase();
  return languages.has(lang_code) && ['source', 'both'].includes(languages.get(lang_code).type);
}

function isTargetLanguage(lang_code) {
  if (lang_code === undefined) return false;
  lang_code = lang_code.toUpperCase();
  return languages.has(lang_code) && ['target', 'both'].includes(languages.get(lang_code).type);
}

function getSourceLanguages() {
  const source_languages = [];
  languages.forEach((lang, code) => {
    if (['source', 'both'].includes(lang.type)) {
      source_languages.push({
        language: code,
        name: lang.name,
      });
    }
  });
  return source_languages;
}

function getTargetLanguages() {
  const target_languages = [];
  languages.forEach((lang, code) => {
    if (['target', 'both'].includes(lang.type)) {
      target_languages.push({
        language: code,
        name: lang.name,
        supports_formality: Boolean(lang.formality),
      });
    }
  });
  return target_languages;
}

function translate_line(input, target_lang) {
  if (input === '') return '';
  // Mock server simplification: each input text is translated to a fixed text for the target language
  return languages.get(target_lang).text;
}

function translate(input, target_lang, source_lang) {
  if (!source_lang) {
    // Mock server simplification: if source_lang undefined and no test-string match, assume source text is English
    source_lang = 'EN';
    for (const [code, lang] of languages) {
      if (input.startsWith(lang.text)) {
        source_lang = code;
        break;
      }
    }
  }

  // Split into lines and translate individually
  const text = input.split('\n').map((input) => (translate_line(input, target_lang))).join('\n');

  const text_short = text.length < 50 ? text : `${text.slice(0, 47)}...`;
  const input_short = input.length < 50 ? input : `${input.slice(0, 47)}...`;
  console.log(`Translated "${input_short}" to "${text_short}"`);
  return { detected_source_language: source_lang, text };
}

module.exports = {
  isSourceLanguage, getSourceLanguages, isTargetLanguage, getTargetLanguages, translate,
};
