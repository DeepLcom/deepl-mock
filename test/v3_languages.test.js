// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
//
// Tests for GET /v3/languages and GET /v3/languages/resources.
//
// These run identically against the mock and the live API, so they double as a
// conformance check that the mock matches production shape:
//   Run against mock:  DEEPL_SERVER_URL=http://localhost:3000 DEEPL_AUTH_KEY=test:fx npm test
//   Run against live:  DEEPL_SERVER_URL=https://api.deepl.com DEEPL_AUTH_KEY=<key> npm test

const { get } = require('./helpers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLang(langs, code) {
  return langs.find((l) => l.lang === code);
}

// `features` is an object map keyed by feature name; return the names.
function featureNamesOf(langs, code) {
  return Object.keys(findLang(langs, code)?.features ?? {});
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
// Parameter handling
// ---------------------------------------------------------------------------

describe('GET /v3/languages — parameter handling', () => {
  it('returns 400 when the resource param is missing', async () => {
    const { status } = await get('/v3/languages');
    expect(status).toBe(400);
  });

  it('returns 400 for an invalid resource value', async () => {
    const { status } = await get('/v3/languages?resource=bogus');
    expect(status).toBe(400);
  });

  it('rejects the old `product` param with the rename guidance', async () => {
    const { status, data } = await get('/v3/languages?product=translate_text');
    expect(status).toBe(400);
    expect(data.message).toMatch(/renamed to ['"]?resource/);
  });
});

// ---------------------------------------------------------------------------
// GET /v3/languages/resources (meta endpoint)
// ---------------------------------------------------------------------------

describe('GET /v3/languages/resources', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages/resources'));
  });

  it('returns 200 with an array', async () => {
    const { status } = await get('/v3/languages/resources');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('contains the seven supported resources', () => {
    const names = data.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(
      ['translate_text', 'translate_document', 'voice', 'write', 'glossary', 'style_rules', 'translation_memory'],
    ));
  });

  it('each resource has a name and a features array', () => {
    data.forEach((resource) => {
      expect(resource).toHaveProperty('name');
      expect(Array.isArray(resource.features)).toBe(true);
      resource.features.forEach((f) => expect(f).toHaveProperty('name'));
    });
  });

  it('translate_text features use needs_source_support / needs_target_support', () => {
    const tt = data.find((r) => r.name === 'translate_text');
    const featureNames = tt.features.map((f) => f.name);
    expect(featureNames).toEqual(expect.arrayContaining(
      ['formality', 'glossary', 'tag_handling', 'style_rules', 'translation_memory'],
    ));
    expect(featureNames).not.toContain('custom_instructions');

    const tagHandling = tt.features.find((f) => f.name === 'tag_handling');
    expect(tagHandling).toMatchObject({ needs_source_support: true, needs_target_support: true });

    const formality = tt.features.find((f) => f.name === 'formality');
    expect(formality).toMatchObject({ needs_target_support: true });
    expect(formality.needs_source_support).toBeUndefined();
  });

  it('style_rules is present with an empty feature list', () => {
    const sr = data.find((r) => r.name === 'style_rules');
    expect(sr).toBeDefined();
    expect(sr.features).toEqual([]);
  });

  it('translation_memory is present with an empty feature list', () => {
    const tm = data.find((r) => r.name === 'translation_memory');
    expect(tm).toBeDefined();
    expect(tm.features).toEqual([]);
  });

  it('voice exposes real feature names (no invented *_external)', () => {
    const vo = data.find((r) => r.name === 'voice');
    const names = vo.features.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['transcription', 'translated_speech']));
    expect(names).not.toContain('transcription_external');
    expect(names).not.toContain('translated_speech_external');
  });
});

// ---------------------------------------------------------------------------
// GET /v3/languages?resource=translate_text
// ---------------------------------------------------------------------------

describe('GET /v3/languages?resource=translate_text', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?resource=translate_text'));
  });

  it('returns 200 with an array', () => {
    expect(Array.isArray(data)).toBe(true);
  });

  it('every entry has the full set of required fields with correct types', () => {
    data.forEach((entry) => {
      expect(typeof entry.lang).toBe('string');
      expect(typeof entry.name).toBe('string');
      expect(entry.status).toBe('stable');
      expect(typeof entry.usable_as_source).toBe('boolean');
      expect(typeof entry.usable_as_target).toBe('boolean');
      // features is an object map (NOT an array), values carry a status
      expect(typeof entry.features).toBe('object');
      expect(Array.isArray(entry.features)).toBe(false);
      Object.values(entry.features).forEach((f) => expect(f).toHaveProperty('status'));
    });
  });

  it('all lang codes are valid BCP-47 with title-case script subtags', () => {
    data.forEach((entry) => expect(bcp47Valid(entry.lang)).toBe(true));
    expect(findLang(data, 'zh-Hans')).toBeDefined();
    expect(findLang(data, 'zh-HANS')).toBeUndefined();
  });

  it('en is usable as both source and target', () => {
    const en = findLang(data, 'en');
    expect(en.usable_as_source).toBe(true);
    expect(en.usable_as_target).toBe(true);
  });

  it('de exposes the live translate_text feature set, with no custom_instructions', () => {
    const de = findLang(data, 'de');
    expect(Object.keys(de.features).sort()).toEqual(
      ['auto_detection', 'formality', 'glossary', 'style_rules', 'tag_handling', 'translation_memory'],
    );
    expect(de.features.glossary).toEqual({ status: 'stable' });
    expect(de.features.custom_instructions).toBeUndefined();
  });

  it('af supports tag_handling but not formality or glossary', () => {
    const names = featureNamesOf(data, 'af');
    expect(names).toContain('tag_handling');
    expect(names).not.toContain('formality');
    expect(names).not.toContain('glossary');
  });

  it('regional variants inherit features from their base language', () => {
    expect(featureNamesOf(data, 'en-GB')).toContain('glossary');
    expect(featureNamesOf(data, 'pt-BR')).toEqual(expect.arrayContaining(['glossary', 'formality']));
  });
});

// ---------------------------------------------------------------------------
// Resources whose languages carry no optional features
// ---------------------------------------------------------------------------

describe('GET /v3/languages?resource=style_rules', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?resource=style_rules'));
  });

  it('returns the style-rule languages with an empty features object', () => {
    expect(Array.isArray(data)).toBe(true);
    const langs = data.map((l) => l.lang);
    expect(langs).toEqual(expect.arrayContaining(['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'zh']));
    data.forEach((entry) => {
      expect(entry.status).toBe('stable');
      expect(entry.features).toEqual({});
    });
  });
});

describe('GET /v3/languages?resource=glossary', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v3/languages?resource=glossary'));
  });

  it('all entries are usable as source and target with an empty features object', () => {
    data.forEach((entry) => {
      expect(entry.usable_as_source).toBe(true);
      expect(entry.usable_as_target).toBe(true);
      expect(entry.features).toEqual({});
    });
  });
});
