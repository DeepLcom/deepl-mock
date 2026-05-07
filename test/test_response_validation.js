// Tests for the opt-in response validation middleware (VALIDATE_RESPONSES=1).
//
// Run:
//   node test/test_response_validation.js
//
// Override the base port when 4010-4014 are in use:
//   TEST_PORT_BASE=5010 node test/test_response_validation.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const AUTH_HEADER = 'DeepL-Auth-Key test-key';
const USER_AGENT = 'test-agent';
const PORT_BASE = Number(process.env.TEST_PORT_BASE) || 4010;

function request(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port,
        method: opts.method || 'GET',
        path: opts.path,
        headers: {
          'User-Agent': USER_AGENT,
          Authorization: AUTH_HEADER,
          ...(opts.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(body); } catch { parsed = body; }
          resolve({ status: res.statusCode, body: parsed, raw: body });
        });
      },
    );
    req.on('error', reject);
    if (opts.body) {
      if (!opts.headers?.['Content-Type']) {
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      }
      req.write(opts.body);
    }
    req.end();
  });
}

function startServer(port, env = {}) {
  const proc = spawn('node', [path.resolve(__dirname, '..', 'index.js')], {
    env: {
      ...process.env,
      DEEPL_MOCK_SERVER_PORT: String(port),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.capturedOutput = '';
  proc.stdout.on('data', (d) => { proc.capturedOutput += d.toString(); });
  proc.stderr.on('data', (d) => { proc.capturedOutput += d.toString(); });
  return proc;
}

function waitForServer(proc, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Server startup timed out. Output:\n${proc.capturedOutput}`)),
      timeoutMs,
    );
    const check = () => {
      if (proc.capturedOutput.includes('listening on port')) {
        clearTimeout(timer);
        resolve();
      }
    };
    check();
    proc.stdout.on('data', check);
    proc.stderr.on('data', check);
  });
}

// ---------------------------------------------------------------------------
// Test 1: Server starts normally with VALIDATE_RESPONSES=1
// ---------------------------------------------------------------------------
async function testServerStartsWithValidation() {
  const port = PORT_BASE;
  const proc = startServer(port, { VALIDATE_RESPONSES: '1' });
  try {
    await waitForServer(proc);
    console.log('PASS: Server starts normally with VALIDATE_RESPONSES=1');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 2: Valid mock response passes without error
// ---------------------------------------------------------------------------
async function testValidResponsePasses() {
  const port = PORT_BASE + 1;
  const proc = startServer(port, { VALIDATE_RESPONSES: '1' });
  try {
    await waitForServer(proc);

    // GET /v2/usage — well-known endpoint
    const usage = await request(port, { path: '/v2/usage' });
    assert.strictEqual(usage.status, 200, `Expected 200 for /v2/usage, got ${usage.status}`);
    assert.ok(
      usage.body.character_count !== undefined,
      'Response should contain character_count',
    );

    // POST /v2/translate — translate a word
    const translate = await request(port, {
      method: 'POST',
      path: '/v2/translate',
      headers: { Authorization: 'DeepL-Auth-Key test-key:fx' },
      body: 'text=Hello&target_lang=DE',
    });
    assert.strictEqual(translate.status, 200, `Expected 200 for /v2/translate, got ${translate.status}`);
    assert.ok(
      Array.isArray(translate.body.translations),
      'Translate response should contain translations array',
    );

    console.log('PASS: Valid mock responses pass without error');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 3: A deliberately broken response triggers a validation error that
//         names the specific field and schema.
//
// We create a minimal Express app with express-openapi-validator configured
// against a small inline spec.  The handler returns a body that violates the
// schema so we can assert that the validator catches it and surfaces the
// specific field and error code.
// ---------------------------------------------------------------------------
async function testBrokenResponseTriggersValidationError() {
  const express = require('express'); // eslint-disable-line global-require
  const OpenApiValidator = require('express-openapi-validator'); // eslint-disable-line global-require
  const { validationErrorHandler } = require('../response-validator'); // eslint-disable-line global-require

  // Minimal inline spec – POST /v2/translate must return { translations: [...] }
  const spec = {
    openapi: '3.0.0',
    info: { title: 'DeepL API (test subset)', version: '1.0.0' },
    paths: {
      '/v2/translate': {
        post: {
          operationId: 'translateText',
          responses: {
            200: {
              description: 'Translated text',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['translations'],
                    properties: {
                      translations: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['detected_source_language', 'text'],
                          properties: {
                            detected_source_language: { type: 'string' },
                            text: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const app = express();

  app.use(
    OpenApiValidator.middleware({
      apiSpec: spec,
      validateApiSpec: false,
      validateRequests: false,
      validateResponses: true,
    }),
  );

  // Deliberately broken handler – spec requires { translations: [...] }
  app.post('/v2/translate', (req, res) => {
    res.status(200).json({ not_translations: 'this is wrong' });
  });

  app.use(validationErrorHandler);

  const port = PORT_BASE + 2;
  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  try {
    const result = await request(port, {
      method: 'POST',
      path: '/v2/translate',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ['Hello'], target_lang: 'DE' }),
    });

    // The response should be an error surfaced by the validation handler
    assert.ok(
      result.status >= 400,
      `Expected error status for broken response, got ${result.status}`,
    );
    assert.ok(result.body.errors, 'Error response should include "errors" array');
    assert.ok(result.body.errors.length > 0, 'Should contain at least one validation error');

    // The error should name the specific field / schema
    const errorDetail = JSON.stringify(result.body.errors);
    assert.ok(
      errorDetail.includes('translations'),
      `Validation error should reference the "translations" field. Got: ${errorDetail}`,
    );

    console.log('PASS: Broken response triggers a named validation error');
    console.log('  Error details:', JSON.stringify(result.body.errors, null, 2));
  } finally {
    server.close();
  }
}

// ---------------------------------------------------------------------------
// Test 4: Without the env var, the validator is not installed at all.
//
// Check the startup log does not contain the validator's init messages, so
// we know the middleware was not registered — not just that a single route
// happened to return 200.
// ---------------------------------------------------------------------------
async function testWithoutEnvVarValidatorNotInstalled() {
  const port = PORT_BASE + 3;
  const proc = startServer(port, { VALIDATE_RESPONSES: '' });
  try {
    await waitForServer(proc);

    const usage = await request(port, { path: '/v2/usage' });
    assert.strictEqual(usage.status, 200, `Expected 200 for /v2/usage, got ${usage.status}`);

    assert.ok(
      !proc.capturedOutput.includes('Loading OpenAPI spec'),
      `Validator should not attempt to load spec.\nOutput:\n${proc.capturedOutput}`,
    );
    assert.ok(
      !proc.capturedOutput.includes('Response validation enabled'),
      `Validator should not be enabled.\nOutput:\n${proc.capturedOutput}`,
    );

    console.log('PASS: Without VALIDATE_RESPONSES, validator is not installed');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 5: Paths listed in IGNORED_PATHS bypass response validation.
//
// Use the real installResponseValidator with a spec that declares
// /v2/translate_secondary strictly, then return a body that violates the
// schema. The request must still succeed because the path is ignored.
// ---------------------------------------------------------------------------
async function testIgnoredPathsBypassValidation() {
  const express = require('express'); // eslint-disable-line global-require
  const {
    installResponseValidator,
    validationErrorHandler,
  } = require('../response-validator'); // eslint-disable-line global-require

  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v2/translate_secondary': {
        post: {
          operationId: 'translateSecondary',
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['translations'],
                    properties: { translations: { type: 'array' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const specFile = path.resolve(__dirname, 'tmp_ignorepath_spec.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const prev = {
    VALIDATE_RESPONSES: process.env.VALIDATE_RESPONSES,
    DEEPL_MOCK_SPEC_PATH: process.env.DEEPL_MOCK_SPEC_PATH,
    DEEPL_MOCK_SPEC_URL: process.env.DEEPL_MOCK_SPEC_URL,
  };
  process.env.VALIDATE_RESPONSES = '1';
  process.env.DEEPL_MOCK_SPEC_PATH = specFile;
  delete process.env.DEEPL_MOCK_SPEC_URL;

  const app = express();
  app.use(express.json());
  await installResponseValidator(app);
  app.post('/v2/translate_secondary', (req, res) => {
    // Deliberately violates the schema above — must pass through because
    // /v2/translate_secondary is in IGNORED_PATHS.
    res.status(200).json({ not_translations: 'this is wrong' });
  });
  app.use(validationErrorHandler);

  const port = PORT_BASE + 4;
  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  try {
    const result = await request(port, {
      method: 'POST',
      path: '/v2/translate_secondary',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.strictEqual(
      result.status,
      200,
      `Ignored path should pass through despite schema mismatch. Got ${result.status}: ${JSON.stringify(result.body)}`,
    );
    assert.deepStrictEqual(result.body, { not_translations: 'this is wrong' });

    console.log('PASS: IGNORED_PATHS bypass response validation');
  } finally {
    server.close();
    fs.unlinkSync(specFile);
    Object.entries(prev).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  }
}

// ---------------------------------------------------------------------------
// Test 6: validationErrorHandler forwards the error instead of writing when
//         response headers have already been sent.
// ---------------------------------------------------------------------------
function testHeadersSentGuard() {
  const { validationErrorHandler } = require('../response-validator'); // eslint-disable-line global-require

  // Case A: headers already sent — must forward to next, must not write.
  {
    const err = { status: 500, errors: [{ path: '/foo' }], message: 'fail' };
    const req = { method: 'GET', path: '/foo' };
    let forwarded = null;
    let wrote = false;
    const res = {
      headersSent: true,
      status: () => { wrote = true; return res; },
      json: () => { wrote = true; },
    };
    validationErrorHandler(err, req, res, (e) => { forwarded = e; });
    assert.strictEqual(forwarded, err, 'headersSent: should forward error to next');
    assert.strictEqual(wrote, false, 'headersSent: should not touch the response');
  }

  // Case B: headers not sent — must write structured error, must not forward.
  {
    const err = { status: 500, errors: [{ path: '/foo' }], message: 'fail' };
    const req = { method: 'GET', path: '/foo' };
    let forwarded = false;
    let statusArg = null;
    let jsonArg = null;
    const res = {
      headersSent: false,
      status: (s) => { statusArg = s; return res; },
      json: (b) => { jsonArg = b; },
    };
    validationErrorHandler(err, req, res, () => { forwarded = true; });
    assert.strictEqual(forwarded, false, 'open response: should not forward');
    assert.strictEqual(statusArg, 500, 'open response: should call res.status(err.status)');
    assert.deepStrictEqual(
      jsonArg,
      { message: 'fail', errors: err.errors },
      'open response: should write { message, errors }',
    );
  }

  console.log('PASS: validationErrorHandler respects headersSent and structures errors');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function main() {
  const tests = [
    ['Server starts with VALIDATE_RESPONSES=1', testServerStartsWithValidation],
    ['Valid response passes', testValidResponsePasses],
    ['Broken response triggers validation error', testBrokenResponseTriggersValidationError],
    ['Without env var, validator is not installed', testWithoutEnvVarValidatorNotInstalled],
    ['IGNORED_PATHS bypass validation', testIgnoredPathsBypassValidation],
    ['headersSent guard forwards error', testHeadersSentGuard],
  ];

  let passed = 0;
  let failed = 0;

  // Tests must run sequentially — each spawns a server on a unique port.
  // eslint-disable-next-line no-restricted-syntax
  for (const [name, fn] of tests) {
    try {
      await fn(); // eslint-disable-line no-await-in-loop
      passed += 1;
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(`  ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed += 1;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
