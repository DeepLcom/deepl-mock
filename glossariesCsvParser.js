// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const csvParser = require('csv-parser');
const { Readable } = require('stream');
const util = require('./util');

function convertGlossaryEntriesCsvToList(entriesCsv, glossarySourceLang, glossaryTargetLang) {
  if (entriesCsv.length === 0) {
    throw new util.HttpError('Bad request', 400, 'Missing or invalid argument: entries');
  }

  return new Promise(((resolve, reject) => {
    const readable = Readable.from([entriesCsv]);
    const results = [];
    readable.pipe(csvParser({ headers: false }))
      .on('data', (data) => {
        const sourceEntry = data[0];
        const targetEntry = data[1];
        const sourceLang = data[2];
        const targetLang = data[3];
        // Ignore empty lines
        if (sourceEntry === undefined || targetEntry === undefined) return;
        // Ignore lines where the source lang or target lang do not match glossary lang
        if (sourceLang !== undefined && targetLang !== undefined
                    && sourceLang.toUpperCase() !== glossarySourceLang.toUpperCase()
                    && targetLang.toUpperCase() !== glossaryTargetLang.toUpperCase()) return;
        results.push({ source: sourceEntry, target: targetEntry });
      })
      .on('end', () => {
        if (results.length === 0) {
          return reject(new util.HttpError('Invalid glossary entries provided', 400));
        }
        return resolve(results);
      })
      .on('error', (err) => reject(err));
  }));
}

module.exports = {
  convertGlossaryEntriesCsvToList,
};
