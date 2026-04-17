// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
//
// Tests for GET /v3/languages and GET /v3/languages/products
//
// Run against mock:  DEEPL_SERVER_URL=http://localhost:3000 DEEPL_AUTH_KEY=test:fx npm test
// Run against live:  DEEPL_SERVER_URL=https://api.deepl.com DEEPL_AUTH_KEY=<key> npm test

const { get } = require('./helpers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLang(langs, code) {
  return langs.find((l) => l.lang === code);
}

function featuresOf(langs, code) {
  return findLang(langs, code)?.features ?? [];
}

function bcp47Valid(code) {
  const parts = code.split('-');
  if (parts[0] !== parts[0].toLowerCase()) return false;
  for (let i = 1; i < parts.length; i += 1) {
    const t = parts[i];
    const isScript = t.length === 4 && /^[a-zA-Z]{4}$/.test(t);
    const expected = isScript
      ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
      : t.toUpperCase();
    if (t !== expected) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /v3/languages — error cases', () => {
  it('returns 400 when product param is missing', async () => {
    const { status } = await get('/v3/languages');
    expect(status).toBe(400);
  });

  it('returns 400 for invalid product value', async () => {
    const { status } = await get('/v3/languages?product=bogus');
    expect(status).toBe(400);
  });
});

describe('GET /v3/languages/products', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages/products'));
  });

  it('returns 200 with array', async () => {
    const { status } = await get('/v3/languages/products');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('contains all five products', () => {
    const names = data.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(
      ['translate_text', 'translate_document', 'voice', 'write', 'glossary'],
    ));
  });

  it('each product has name and features array', () => {
    data.forEach((product) => {
      expect(product).toHaveProperty('name');
      expect(Array.isArray(product.features)).toBe(true);
      product.features.forEach((f) => expect(f).toHaveProperty('name'));
    });
  });

  it('translate_text has expected features with correct required_on fields', () => {
    const tt = data.find((p) => p.name === 'translate_text');
    const featureNames = tt.features.map((f) => f.name);
    expect(featureNames).toEqual(expect.arrayContaining(
      ['custom_instructions', 'formality', 'glossary', 'tag_handling'],
    ));

    const tagHandling = tt.features.find((f) => f.name === 'tag_handling');
    expect(tagHandling).toMatchObject({ required_on_source: true, required_on_target: true });

    const formality = tt.features.find((f) => f.name === 'formality');
    expect(formality).toMatchObject({ required_on_target: true });
    expect(formality.required_on_source).toBeUndefined();
  });

  it('write has tone and writing_style features', () => {
    const wr = data.find((p) => p.name === 'write');
    const names = wr.features.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['tone', 'writing_style']));
  });

  it('voice has transcription and translated_speech features', () => {
    const vo = data.find((p) => p.name === 'voice');
    const names = vo.features.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(
      ['auto_detection', 'transcription', 'translated_speech'],
    ));
  });
});

describe('GET /v3/languages?product=translate_text', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?product=translate_text'));
  });

  it('returns 200 with array', () => {
    expect(Array.isArray(data)).toBe(true);
  });

  it('all lang codes are valid BCP-47', () => {
    data.forEach((entry) => {
      expect(bcp47Valid(entry.lang)).toBe(true);
    });
  });

  it('each entry has required fields with correct types', () => {
    data.forEach((entry) => {
      expect(entry).toHaveProperty('lang');
      expect(entry).toHaveProperty('name');
      expect(typeof entry.usable_as_source).toBe('boolean');
      expect(typeof entry.usable_as_target).toBe('boolean');
      expect(Array.isArray(entry.features)).toBe(true);
    });
  });

  it('uses title-case script subtags (zh-Hans not zh-HANS)', () => {
    expect(findLang(data, 'zh-Hans')).toBeDefined();
    expect(findLang(data, 'zh-Hant')).toBeDefined();
    expect(findLang(data, 'zh-HANS')).toBeUndefined();
    expect(findLang(data, 'zh-HANT')).toBeUndefined();
  });

  it('en is usable as both source and target', () => {
    const en = findLang(data, 'en');
    expect(en).toBeDefined();
    expect(en.usable_as_source).toBe(true);
    expect(en.usable_as_target).toBe(true);
  });

  it('pt is usable as both source and target', () => {
    const pt = findLang(data, 'pt');
    expect(pt).toBeDefined();
    expect(pt.usable_as_source).toBe(true);
    expect(pt.usable_as_target).toBe(true);
  });

  it('de has formality, glossary, custom_instructions, tag_handling', () => {
    expect(featuresOf(data, 'de')).toEqual(expect.arrayContaining(
      ['formality', 'glossary', 'custom_instructions', 'tag_handling'],
    ));
  });

  it('pt has formality (defaults to formality-supporting variant)', () => {
    expect(featuresOf(data, 'pt')).toContain('formality');
  });

  it('en-GB has glossary via base code EN', () => {
    expect(featuresOf(data, 'en-GB')).toContain('glossary');
  });

  it('pt-BR has glossary and formality via base code PT', () => {
    expect(featuresOf(data, 'pt-BR')).toEqual(expect.arrayContaining(['glossary', 'formality']));
  });

  it('es-419 has glossary and formality via base code ES', () => {
    expect(featuresOf(data, 'es-419')).toEqual(expect.arrayContaining(['glossary', 'formality']));
  });

  it('zh-Hans has glossary and custom_instructions', () => {
    expect(featuresOf(data, 'zh-Hans')).toEqual(expect.arrayContaining(['glossary', 'custom_instructions']));
  });

  it('af has only tag_handling — no formality or glossary', () => {
    const features = featuresOf(data, 'af');
    expect(features).toContain('tag_handling');
    expect(features).not.toContain('formality');
    expect(features).not.toContain('glossary');
  });
});

describe('GET /v3/languages?product=translate_document', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?product=translate_document'));
  });

  it('no language has tag_handling feature', () => {
    data.forEach((entry) => {
      expect(entry.features).not.toContain('tag_handling');
    });
  });

  it('de has formality and glossary', () => {
    expect(featuresOf(data, 'de')).toEqual(expect.arrayContaining(['formality', 'glossary']));
  });

  it('pt-BR has glossary', () => {
    expect(featuresOf(data, 'pt-BR')).toContain('glossary');
  });

  it('en and pt are usable_as_target', () => {
    expect(findLang(data, 'en')?.usable_as_target).toBe(true);
    expect(findLang(data, 'pt')?.usable_as_target).toBe(true);
  });
});

describe('GET /v3/languages?product=write', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?product=write'));
  });

  it('includes de, en, en-GB', () => {
    const langs = data.map((l) => l.lang);
    expect(langs).toEqual(expect.arrayContaining(['de', 'en', 'en-GB']));
  });

  it('en is usable_as_target', () => {
    expect(findLang(data, 'en')?.usable_as_target).toBe(true);
  });

  it('de and en-GB have tone and writing_style features', () => {
    ['de', 'en-GB', 'en-US'].forEach((code) => {
      const features = featuresOf(data, code);
      expect(features).toContain('tone');
      expect(features).toContain('writing_style');
    });
  });

  it('no zh-HANS casing in write', () => {
    expect(findLang(data, 'zh-HANS')).toBeUndefined();
  });
});

describe('GET /v3/languages?product=voice', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?product=voice'));
  });

  it('de has full feature set', () => {
    expect(featuresOf(data, 'de')).toEqual(expect.arrayContaining(
      ['auto_detection', 'formality', 'glossary', 'transcription', 'translated_speech'],
    ));
  });

  it('en is usable_as_target', () => {
    expect(findLang(data, 'en')?.usable_as_target).toBe(true);
  });

  it('en-GB has translated_speech but not transcription', () => {
    const features = featuresOf(data, 'en-GB');
    expect(features).toContain('translated_speech');
    expect(features).not.toContain('transcription');
  });

  it('bn has transcription_external only (no transcription or translated_speech)', () => {
    const features = featuresOf(data, 'bn');
    expect(features).toContain('transcription_external');
    expect(features).not.toContain('transcription');
    expect(features).not.toContain('translated_speech');
  });

  it('uses title-case script subtags', () => {
    expect(findLang(data, 'zh-Hans')).toBeDefined();
    expect(findLang(data, 'zh-HANS')).toBeUndefined();
  });
});

describe('GET /v3/languages?product=glossary', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?product=glossary'));
  });

  it('all entries are usable as source and target with no features', () => {
    data.forEach((entry) => {
      expect(entry.usable_as_source).toBe(true);
      expect(entry.usable_as_target).toBe(true);
      expect(entry.features).toHaveLength(0);
    });
  });

  it('includes core and expanded glossary languages', () => {
    const langs = data.map((l) => l.lang);
    expect(langs).toEqual(expect.arrayContaining(
      ['de', 'en', 'fr', 'es', 'it', 'ja', 'zh', 'ar', 'ko', 'ru', 'uk', 'id'],
    ));
  });
});
