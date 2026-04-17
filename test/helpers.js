// Copyright 2026 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const https = require('https');
const http = require('http');

const BASE_URL = process.env.DEEPL_SERVER_URL || 'http://localhost:3000';
const AUTH_KEY = process.env.DEEPL_AUTH_KEY || 'test:fx';

// Sends an authenticated GET request and returns { status, data }.
// data is the parsed JSON body on 200, null otherwise.
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
          'User-Agent': 'languages-test',
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

module.exports = { get };
