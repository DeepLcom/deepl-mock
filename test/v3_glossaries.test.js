// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.
//
// Tests for v3 multilingual glossary behaviour.

const glossariesV3 = require('../glossariesV3');

describe('getDictionaryEntries', () => {
  it('returns language codes in lowercase regardless of request casing', async () => {
    const authKey = 'test-auth-key';
    const created = await glossariesV3.createGlossary('Casing Test', authKey, [
      {
        sourceLang: 'en', targetLang: 'de', entriesFormat: 'tsv', entries: 'Hello\tHallo',
      },
    ]);

    // The request handler upper-cases the query params (source_lang/target_lang
    // are read with upper: true). The response must still be lowercase, matching
    // the real API and the create/list responses.
    const result = glossariesV3.getDictionaryEntries(created.glossary_id, 'EN', 'DE', authKey);

    expect(result.dictionaries[0].source_lang).toBe('en');
    expect(result.dictionaries[0].target_lang).toBe('de');
  });
});
