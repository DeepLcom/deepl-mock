// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
//
// Tests for GET /v2/languages and GET /v2/glossary-language-pairs
//
// Run against mock:  DEEPL_SERVER_URL=http://localhost:3000 DEEPL_AUTH_KEY=test:fx npm test
// Run against live:  DEEPL_SERVER_URL=https://api.deepl.com DEEPL_AUTH_KEY=<key> npm test

const https = require('https');
const http = require('http');

const BASE_URL = process.env.DEEPL_SERVER_URL || 'http://localhost:3000';
const AUTH_KEY = process.env.DEEPL_AUTH_KEY || 'test:fx';

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'v2-languages-test',
          Authorization: `DeepL-Auth-Key ${AUTH_KEY}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({
          status: res.statusCode,
          data: res.statusCode === 200 ? JSON.parse(body) : null,
        }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLang(langs, code) {
  return langs.find((l) => l.language === code);
}

// ---------------------------------------------------------------------------
// Tests — GET /v2/languages?type=source
// ---------------------------------------------------------------------------

describe('GET /v2/languages?type=source', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v2/languages?type=source'));
  });

  it('returns 200 with array', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has uppercase language code and name', () => {
    data.forEach((entry) => {
      expect(typeof entry.language).toBe('string');
      expect(entry.language).toBe(entry.language.toUpperCase());
      expect(typeof entry.name).toBe('string');
    });
  });

  it('contains core source languages', () => {
    const codes = data.map((l) => l.language);
    expect(codes).toEqual(expect.arrayContaining(['DE', 'EN', 'FR', 'ES', 'IT', 'JA', 'KO', 'ZH', 'NL', 'PL', 'PT', 'RU']));
  });

  it('does not contain target-only variants', () => {
    const codes = data.map((l) => l.language);
    ['EN-GB', 'EN-US', 'PT-BR', 'PT-PT', 'ZH-HANS', 'ZH-HANT', 'ES-419'].forEach((code) => {
      expect(codes).not.toContain(code);
    });
  });

  it('does not contain new languages hidden from v2', () => {
    const codes = data.map((l) => l.language);
    ['ACE', 'BHO', 'CEB', 'CKB', 'GOM', 'KMR', 'LMO', 'MAI', 'PAG', 'PAM', 'PRS', 'SCN', 'YUE'].forEach((code) => {
      expect(codes).not.toContain(code);
    });
  });

  it('zh entry has name "Chinese"', () => {
    expect(findLang(data, 'ZH')).toMatchObject({ language: 'ZH', name: 'Chinese' });
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /v2/languages (default) and type=target
// ---------------------------------------------------------------------------

describe('GET /v2/languages (default type)', () => {
  it('defaults to source — same result as type=source', async () => {
    const [defaultRes, sourceRes] = await Promise.all([
      get('/v2/languages'),
      get('/v2/languages?type=source'),
    ]);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.data).toEqual(sourceRes.data);
  });
});

describe('GET /v2/languages?type=target', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v2/languages?type=target'));
  });

  it('returns 200 with array', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has language, name, supports_formality boolean', () => {
    data.forEach((entry) => {
      expect(typeof entry.language).toBe('string');
      expect(entry.language).toBe(entry.language.toUpperCase());
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.supports_formality).toBe('boolean');
    });
  });

  it('contains target variants EN-GB, EN-US, PT-BR, ZH-HANS', () => {
    const codes = data.map((l) => l.language);
    expect(codes).toEqual(expect.arrayContaining(['EN-GB', 'EN-US', 'PT-BR', 'ZH-HANS']));
  });

  it('does not contain EN or PT (hidden from v2 target endpoint)', () => {
    const codes = data.map((l) => l.language);
    expect(codes).not.toContain('EN');
    expect(codes).not.toContain('PT');
  });

  it('does not contain new languages hidden from v2', () => {
    const codes = data.map((l) => l.language);
    ['ACE', 'BHO', 'CEB', 'CKB', 'YUE'].forEach((code) => {
      expect(codes).not.toContain(code);
    });
  });

  it('formality-supporting languages have supports_formality=true', () => {
    ['DE', 'ES', 'FR', 'IT', 'JA', 'NL', 'PL', 'PT-BR', 'PT-PT', 'RU'].forEach((code) => {
      const entry = findLang(data, code);
      expect(entry).toBeDefined();
      expect(entry.supports_formality).toBe(true);
    });
  });

  it('non-formality languages have supports_formality=false', () => {
    ['EN-GB', 'EN-US', 'ZH-HANS'].forEach((code) => {
      const entry = findLang(data, code);
      expect(entry).toBeDefined();
      expect(entry.supports_formality).toBe(false);
    });
  });

  it('zh entry uses V2 target name "Chinese (simplified)"', () => {
    expect(findLang(data, 'ZH')).toMatchObject({
      language: 'ZH',
      name: 'Chinese (simplified)',
      supports_formality: false,
    });
  });
});

describe('GET /v2/languages — error cases', () => {
  it('returns 400 for invalid type value', async () => {
    const { status } = await get('/v2/languages?type=voice');
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /v2/glossary-language-pairs
// ---------------------------------------------------------------------------

describe('GET /v2/glossary-language-pairs', () => {
  let data;

  beforeAll(async () => {
    ({ data } = await get('/v2/glossary-language-pairs'));
  });

  it('returns 200 with supported_languages array', () => {
    expect(Array.isArray(data.supported_languages)).toBe(true);
    expect(data.supported_languages.length).toBeGreaterThan(0);
  });

  it('each pair has source_lang and target_lang', () => {
    data.supported_languages.forEach((pair) => {
      expect(typeof pair.source_lang).toBe('string');
      expect(typeof pair.target_lang).toBe('string');
    });
  });

  it('no pair has source_lang === target_lang', () => {
    data.supported_languages.forEach((pair) => {
      expect(pair.source_lang).not.toBe(pair.target_lang);
    });
  });

  it('language codes are lowercase', () => {
    data.supported_languages.forEach((pair) => {
      expect(pair.source_lang).toBe(pair.source_lang.toLowerCase());
      expect(pair.target_lang).toBe(pair.target_lang.toLowerCase());
    });
  });

  it('contains expected pairs', () => {
    const pairs = data.supported_languages.map((p) => `${p.source_lang}:${p.target_lang}`);
    expect(pairs).toEqual(expect.arrayContaining(['de:en', 'en:de', 'ja:zh', 'zh:ja', 'ar:en', 'en:ar']));
  });

  it('contains all expected glossary languages as sources', () => {
    const sources = new Set(data.supported_languages.map((p) => p.source_lang));
    ['ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr',
      'he', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl',
      'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi', 'zh',
    ].forEach((lang) => expect(sources.has(lang)).toBe(true));
  });

  it('pair count equals n*(n-1) for n glossary languages', () => {
    const sources = new Set(data.supported_languages.map((p) => p.source_lang));
    const n = sources.size;
    expect(data.supported_languages).toHaveLength(n * (n - 1));
  });
});
