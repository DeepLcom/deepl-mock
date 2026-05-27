// Tests for the request-side codegen-safety helpers added in 1.21.0:
//   - mock-server-session-5xx-count session header (transient 5xx)
//   - GET /__session__/last-request endpoint (per-session request capture)
//   - VALIDATE_REQUESTS=1 opt-in request-shape spec validation
//   - mock-server-session-allow-extra-body session-level escape hatch
//
// Run:
//   node test/test_request_helpers.js
//
// Override the base port when 4020-4029 are in use:
//   TEST_PORT_BASE=5020 node test/test_request_helpers.js

const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const AUTH_HEADER = 'DeepL-Auth-Key test-key';
const USER_AGENT = 'test-agent';
const PORT_BASE = Number(process.env.TEST_PORT_BASE) || 4020;

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
// Test 1: mock-server-session-5xx-count returns the configured number of 5xx
//         responses on any endpoint, defaults to 503, then resumes normal
//         behaviour. Decrement is per-request, mirroring the 429 mechanism.
// ---------------------------------------------------------------------------
async function test5xxCountDefault503() {
  const port = PORT_BASE;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-5xx-default';
    const opts = {
      path: '/v2/usage',
      headers: {
        'mock-server-session': session,
        'mock-server-session-5xx-count': '2',
      },
    };

    const r1 = await request(port, opts);
    const r2 = await request(port, { path: '/v2/usage', headers: { 'mock-server-session': session } });
    const r3 = await request(port, { path: '/v2/usage', headers: { 'mock-server-session': session } });

    assert.strictEqual(r1.status, 503, `1st request: expected 503, got ${r1.status}`);
    assert.strictEqual(r2.status, 503, `2nd request: expected 503, got ${r2.status}`);
    assert.strictEqual(r3.status, 200, `3rd request: expected 200, got ${r3.status}`);

    console.log('PASS: 5xx-count returns N 503s then resumes');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 2: mock-server-session-5xx-status overrides the default 503.
// ---------------------------------------------------------------------------
async function test5xxStatusOverride() {
  const port = PORT_BASE + 1;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-5xx-502';
    const r1 = await request(port, {
      path: '/v2/usage',
      headers: {
        'mock-server-session': session,
        'mock-server-session-5xx-count': '1',
        'mock-server-session-5xx-status': '502',
      },
    });
    const r2 = await request(port, {
      path: '/v2/usage',
      headers: { 'mock-server-session': session },
    });

    assert.strictEqual(r1.status, 502, `1st request: expected 502, got ${r1.status}`);
    assert.strictEqual(r2.status, 200, `2nd request: expected 200, got ${r2.status}`);

    console.log('PASS: 5xx-status overrides the default');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 3: GET /__session__/last-request returns the body, method, path,
//         query and headers of the previous request in that session.
// ---------------------------------------------------------------------------
async function testLastRequestCapture() {
  const port = PORT_BASE + 2;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-capture';
    const translate = await request(port, {
      method: 'POST',
      path: '/v2/translate',
      headers: { 'mock-server-session': session },
      body: 'text=Hello&target_lang=DE&model_type=quality_optimized',
    });
    assert.strictEqual(translate.status, 200, `translate: expected 200, got ${translate.status}`);

    const captured = await request(port, {
      path: '/__session__/last-request',
      headers: { 'mock-server-session': session },
    });

    assert.strictEqual(captured.status, 200);
    assert.strictEqual(captured.body.method, 'POST');
    assert.strictEqual(captured.body.path, '/v2/translate');
    assert.strictEqual(
      captured.body.body.model_type,
      'quality_optimized',
      `expected body.model_type=quality_optimized, got ${JSON.stringify(captured.body.body)}`,
    );
    assert.strictEqual(captured.body.body.target_lang, 'DE');
    assert.ok(captured.body.headers, 'headers should be present');

    console.log('PASS: /__session__/last-request reflects the captured request');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 4: /__session__/last-request rejects missing session header and
//         returns 404 for a session that has not yet captured a request.
//         The endpoint itself is excluded from capture (cannot capture itself).
// ---------------------------------------------------------------------------
async function testLastRequestErrorCases() {
  const port = PORT_BASE + 3;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const noSession = await request(port, { path: '/__session__/last-request' });
    assert.strictEqual(
      noSession.status,
      400,
      `no session header: expected 400, got ${noSession.status}`,
    );

    const neverUsed = await request(port, {
      path: '/__session__/last-request',
      headers: { 'mock-server-session': 'helpers-capture-empty' },
    });
    assert.strictEqual(
      neverUsed.status,
      404,
      `never-used session: expected 404, got ${neverUsed.status}`,
    );

    console.log('PASS: /__session__/last-request 400 missing session, 404 no capture');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 4b: Real DeepL API endpoints excluded from spec validation for
//          unrelated reasons (binary bodies, not-yet-in-spec) MUST still be
//          subject to 5xx fault injection and request capture — SDK retry
//          tests need to drive faults on those endpoints.
// ---------------------------------------------------------------------------
async function test5xxAppliesToValidationExcludedRealPaths() {
  const port = PORT_BASE + 8;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    // /v3/languages is excluded from spec validation (not-yet-in-spec) but
    // is a real API endpoint — 5xx injection must apply.
    const session = 'helpers-5xx-real-paths';
    const r1 = await request(port, {
      path: '/v3/languages?product=translate_text',
      headers: {
        'mock-server-session': session,
        'mock-server-session-5xx-count': '1',
      },
    });
    assert.strictEqual(
      r1.status,
      503,
      `/v3/languages should receive injected 503, got ${r1.status}`,
    );

    // /v2/translate_secondary is mock-only-named but registered as a normal
    // route — SDK path-override tests need to be able to drive 5xx on it.
    const session2 = 'helpers-5xx-secondary';
    const r2 = await request(port, {
      method: 'POST',
      path: '/v2/translate_secondary',
      headers: {
        'mock-server-session': session2,
        'mock-server-session-5xx-count': '1',
      },
      body: 'text=Hello&target_lang=DE',
    });
    assert.strictEqual(
      r2.status,
      503,
      `/v2/translate_secondary should receive injected 503, got ${r2.status}`,
    );

    console.log('PASS: 5xx applies to real API paths that are validation-excluded');
  } finally {
    proc.kill();
  }
}

async function testCaptureAppliesToValidationExcludedRealPaths() {
  const port = PORT_BASE + 9;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-capture-real-paths';
    const langs = await request(port, {
      path: '/v3/languages?product=translate_text',
      headers: { 'mock-server-session': session },
    });
    assert.strictEqual(langs.status, 200);

    const captured = await request(port, {
      path: '/__session__/last-request',
      headers: { 'mock-server-session': session },
    });
    assert.strictEqual(captured.status, 200);
    assert.strictEqual(
      captured.body.path,
      '/v3/languages',
      `expected captured path /v3/languages, got ${captured.body.path}`,
    );
    assert.strictEqual(
      captured.body.query.product,
      'translate_text',
      `expected query.product=translate_text, got ${JSON.stringify(captured.body.query)}`,
    );

    console.log('PASS: capture applies to real API paths that are validation-excluded');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 5: /__session__/last-request bypasses 5xx fault injection, so tests
//         can read state reliably while the 5xx mechanism is armed.
// ---------------------------------------------------------------------------
async function testLastRequestBypasses5xx() {
  const port = PORT_BASE + 4;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-capture-during-5xx';

    // Arm 5xx and make a normal request that gets the 5xx.
    const failed = await request(port, {
      path: '/v2/usage',
      headers: {
        'mock-server-session': session,
        'mock-server-session-5xx-count': '5',
      },
    });
    assert.strictEqual(failed.status, 503);

    // last-request must NOT be 5xx-injected — it's a mock-only helper.
    const captured = await request(port, {
      path: '/__session__/last-request',
      headers: { 'mock-server-session': session },
    });
    assert.strictEqual(
      captured.status,
      200,
      `/__session__/last-request should bypass 5xx, got ${captured.status}`,
    );
    assert.strictEqual(captured.body.path, '/v2/usage');

    console.log('PASS: /__session__/last-request bypasses 5xx fault injection');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 6: VALIDATE_REQUESTS=1 catches a spec-non-conformant request body and
//         returns a structured 4xx that names the offending field.
//
// Uses a minimal inline spec served from a tmp file via DEEPL_MOCK_SPEC_PATH
// so this test is independent of the live DeepL OpenAPI spec content.
// ---------------------------------------------------------------------------
async function testValidateRequestsCatchesBadBody() {
  const fs = require('fs'); // eslint-disable-line global-require
  const port = PORT_BASE + 5;
  const specFile = path.resolve(__dirname, 'tmp_request_validation_spec.json');

  // Spec declares POST /v2/usage requiring a body with required field "name"
  // of type string. The mock's /v2/usage handler ignores the body, but the
  // request validator will catch the missing field BEFORE the handler runs.
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v2/usage': {
        post: {
          operationId: 'usage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  additionalProperties: false,
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  };
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const proc = startServer(port, {
    VALIDATE_REQUESTS: '1',
    DEEPL_MOCK_SPEC_PATH: specFile,
  });
  try {
    await waitForServer(proc);

    // Missing required field "name" — validator should 4xx.
    const bad = await request(port, {
      method: 'POST',
      path: '/v2/usage',
      headers: {
        'Content-Type': 'application/json',
        'mock-server-session': 'helpers-validate-bad',
      },
      body: JSON.stringify({}),
    });
    assert.ok(
      bad.status >= 400 && bad.status < 500,
      `bad request: expected 4xx, got ${bad.status}`,
    );
    assert.ok(bad.body.errors, 'response should include errors array');
    assert.ok(
      JSON.stringify(bad.body.errors).includes('name'),
      `error should reference 'name'. Got ${JSON.stringify(bad.body.errors)}`,
    );

    console.log('PASS: VALIDATE_REQUESTS=1 catches non-conforming request body');
  } finally {
    proc.kill();
    fs.unlinkSync(specFile);
  }
}

// ---------------------------------------------------------------------------
// Test 7: mock-server-session-allow-extra-body bypasses request validation
//         for that session. The same body that fails in test 6 succeeds
//         when the session is created with the escape-hatch header.
// ---------------------------------------------------------------------------
async function testAllowExtraBodyEscapesValidation() {
  const fs = require('fs'); // eslint-disable-line global-require
  const port = PORT_BASE + 6;
  const specFile = path.resolve(__dirname, 'tmp_allow_extra_body_spec.json');

  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v2/usage': {
        post: {
          operationId: 'usage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  additionalProperties: false,
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  };
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const proc = startServer(port, {
    VALIDATE_REQUESTS: '1',
    DEEPL_MOCK_SPEC_PATH: specFile,
  });
  try {
    await waitForServer(proc);

    // Same body as the failing case in test 6, but the session is created
    // with allow-extra-body. The validator must be bypassed and the request
    // must reach the handler (which returns 200).
    const escaped = await request(port, {
      method: 'POST',
      path: '/v2/usage',
      headers: {
        'Content-Type': 'application/json',
        'mock-server-session': 'helpers-allow-extra',
        'mock-server-session-allow-extra-body': '1',
      },
      body: JSON.stringify({ totally: 'not-spec-conforming' }),
    });
    assert.strictEqual(
      escaped.status,
      200,
      `allow-extra-body should bypass validator, got ${escaped.status}: ${JSON.stringify(escaped.body)}`,
    );

    console.log('PASS: mock-server-session-allow-extra-body bypasses request validation');
  } finally {
    proc.kill();
    fs.unlinkSync(specFile);
  }
}

// ---------------------------------------------------------------------------
// Test 8: Without VALIDATE_REQUESTS, the request validator is not installed.
//         A non-conforming body is accepted as before.
// ---------------------------------------------------------------------------
async function testWithoutEnvVarNoRequestValidation() {
  const port = PORT_BASE + 7;
  const proc = startServer(port, { VALIDATE_REQUESTS: '' });
  try {
    await waitForServer(proc);

    const r = await request(port, {
      method: 'POST',
      path: '/v2/usage',
      headers: {
        'Content-Type': 'application/json',
        'mock-server-session': 'helpers-novalidate',
      },
      body: JSON.stringify({ anything: 'goes' }),
    });
    assert.strictEqual(r.status, 200, `without env var, expected 200, got ${r.status}`);
    assert.ok(
      !proc.capturedOutput.includes('Request validation enabled'),
      `validator should not be enabled.\nOutput:\n${proc.capturedOutput}`,
    );

    console.log('PASS: Without VALIDATE_REQUESTS, request validator is not installed');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 9: allow-extra-body must bypass ONLY request validation. When both
//         VALIDATE_REQUESTS=1 and VALIDATE_RESPONSES=1 are set, the escape
//         hatch lets a non-spec-conforming request reach the handler, but
//         the response is still validated against the spec.
// ---------------------------------------------------------------------------
async function testAllowExtraBodyDoesNotBypassResponseValidation() {
  const fs = require('fs'); // eslint-disable-line global-require
  const port = PORT_BASE + 10;
  const specFile = path.resolve(__dirname, 'tmp_combined_validation_spec.json');

  // Spec deliberately misaligned from mock's actual /v2/usage response shape:
  // - Request requires "name" (mock ignores body, so request validation
  //   would 4xx for any test that doesn't send it).
  // - Response requires "absent_field" which the mock's handler will never
  //   return — so response validation will 5xx whenever the request reaches
  //   the handler.
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v2/usage': {
        post: {
          operationId: 'usage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  additionalProperties: false,
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['absent_field'],
                    properties: { absent_field: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const proc = startServer(port, {
    VALIDATE_REQUESTS: '1',
    VALIDATE_RESPONSES: '1',
    DEEPL_MOCK_SPEC_PATH: specFile,
  });
  try {
    await waitForServer(proc);

    // Escape hatch on. Body is non-spec-conforming (missing required "name")
    // — request validator must skip it. The handler runs and returns the
    // mock's normal /v2/usage response, which does NOT contain "absent_field"
    // — so the response validator must still fire and 5xx.
    const r = await request(port, {
      method: 'POST',
      path: '/v2/usage',
      headers: {
        'Content-Type': 'application/json',
        'mock-server-session': 'helpers-combined',
        'mock-server-session-allow-extra-body': '1',
      },
      body: JSON.stringify({ totally: 'wrong' }),
    });

    assert.ok(
      r.status >= 500 && r.status < 600,
      `expected response-validation 5xx, got ${r.status}: ${JSON.stringify(r.body)}`,
    );
    assert.ok(r.body.errors, 'response should include errors array from response validator');
    assert.ok(
      JSON.stringify(r.body.errors).includes('absent_field'),
      `error should reference 'absent_field'. Got ${JSON.stringify(r.body.errors)}`,
    );

    console.log('PASS: allow-extra-body bypasses request validation only, not response validation');
  } finally {
    proc.kill();
    fs.unlinkSync(specFile);
  }
}

// ---------------------------------------------------------------------------
// Test 10: Invalid mock-server-session-5xx-status values fall back to 503.
//         Covers three rejection paths: out-of-range below 500, out-of-range
//         above 599, and non-numeric (rejected by sessions.js as NaN).
// ---------------------------------------------------------------------------
async function test5xxStatusInvalidFallsBackTo503() {
  const port = PORT_BASE + 11;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const cases = [
      { label: 'below-range', session: 'helpers-5xx-200', value: '200' },
      { label: 'above-range', session: 'helpers-5xx-999', value: '999' },
      // sessions.js rejects NaN values with a console.error and never sets
      // respond_5xx_status, so respondWith5xx falls back to 503.
      { label: 'non-numeric', session: 'helpers-5xx-abc', value: 'abc' },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const c of cases) {
      // eslint-disable-next-line no-await-in-loop
      const r = await request(port, {
        path: '/v2/usage',
        headers: {
          'mock-server-session': c.session,
          'mock-server-session-5xx-count': '1',
          'mock-server-session-5xx-status': c.value,
        },
      });
      assert.strictEqual(
        r.status,
        503,
        `${c.label} (${c.value}): expected fallback 503, got ${r.status}`,
      );
    }

    console.log('PASS: invalid 5xx-status (below-range / above-range / NaN) falls back to 503');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 11: /__session__/last-request captures multipart document uploads.
//         /v2/document is the only API endpoint that does not go through
//         express.json(); request bodies are parsed by express-fileupload
//         into req.body (form fields) and req.files (the file blob).
//         The capture hook reads req.body, which should contain the form
//         fields by the time res.on('finish') fires.
// ---------------------------------------------------------------------------
async function testCaptureMultipartUpload() {
  const port = PORT_BASE + 12;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const session = 'helpers-capture-multipart';
    const boundary = '----nodeReqMultipartBoundary';
    const fileContents = 'proton beam';
    const bodyParts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="target_lang"',
      '',
      'DE',
      `--${boundary}`,
      'Content-Disposition: form-data; name="source_lang"',
      '',
      'EN',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="hello.txt"',
      'Content-Type: text/plain',
      '',
      fileContents,
      `--${boundary}--`,
      '',
    ];
    const body = bodyParts.join('\r\n');

    const upload = await request(port, {
      method: 'POST',
      path: '/v2/document',
      headers: {
        'mock-server-session': session,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      },
      body,
    });
    assert.strictEqual(
      upload.status,
      200,
      `multipart upload: expected 200, got ${upload.status}: ${JSON.stringify(upload.body)}`,
    );

    const captured = await request(port, {
      path: '/__session__/last-request',
      headers: { 'mock-server-session': session },
    });
    assert.strictEqual(captured.status, 200);
    assert.strictEqual(captured.body.method, 'POST');
    assert.strictEqual(captured.body.path, '/v2/document');
    // express-fileupload writes form fields into req.body
    assert.strictEqual(
      captured.body.body.target_lang,
      'DE',
      `expected captured body.target_lang=DE, got ${JSON.stringify(captured.body.body)}`,
    );
    assert.strictEqual(captured.body.body.source_lang, 'EN');

    console.log('PASS: /__session__/last-request captures multipart upload form fields');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Test 13: VALIDATE_REQUESTS=1 with coerceTypes accepts URL-query strings
//          for typed primitive schemas (regression for AE-629).
// ---------------------------------------------------------------------------
async function testValidateRequestsCoercesQueryParams() {
  const fs = require('fs'); // eslint-disable-line global-require
  const port = PORT_BASE + 13;
  const specFile = path.resolve(__dirname, 'tmp_request_validation_coerce_spec.json');

  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v2/usage': {
        get: {
          operationId: 'usage',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'detailed', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  };
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const proc = startServer(port, {
    VALIDATE_REQUESTS: '1',
    DEEPL_MOCK_SPEC_PATH: specFile,
  });
  try {
    await waitForServer(proc);

    const r = await request(port, {
      method: 'GET',
      path: '/v2/usage?page=0&detailed=true',
      headers: { 'mock-server-session': 'helpers-validate-coerce' },
    });
    assert.strictEqual(
      r.status,
      200,
      `expected 200 after coercion, got ${r.status} body=${JSON.stringify(r.body)}`,
    );

    console.log('PASS: VALIDATE_REQUESTS=1 coerces wire-format strings to typed query params');
  } finally {
    proc.kill();
    fs.unlinkSync(specFile);
  }
}

// ---------------------------------------------------------------------------
// Test 14: With VALIDATE_REQUESTS=1 + coerceTypes, the live /v3/style_rules
//          and /v3/translation_memories handlers must tolerate the typed
//          values the validator hands them. Catches the class of bug where
//          a handler's `allowedValues` array hard-codes only strings.
// ---------------------------------------------------------------------------
async function testHandlersTolerateCoercedQueryTypes() {
  const fs = require('fs'); // eslint-disable-line global-require
  const port = PORT_BASE + 14;
  const specFile = path.resolve(__dirname, 'tmp_request_validation_handler_spec.json');

  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test spec', version: '1.0.0' },
    paths: {
      '/v3/style_rules': {
        get: {
          operationId: 'listStyleRules',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'page_size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25 } },
            { name: 'detailed', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { 200: { description: 'ok' } },
        },
      },
      '/v3/translation_memories': {
        get: {
          operationId: 'listTranslationMemories',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'page_size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25 } },
          ],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  };
  fs.writeFileSync(specFile, JSON.stringify(spec));

  const proc = startServer(port, {
    VALIDATE_REQUESTS: '1',
    DEEPL_MOCK_SPEC_PATH: specFile,
  });
  try {
    await waitForServer(proc);

    const r1 = await request(port, {
      method: 'GET',
      path: '/v3/style_rules?page=0&page_size=10&detailed=true',
      headers: { 'mock-server-session': 'helpers-coerce-handler-1' },
    });
    assert.strictEqual(r1.status, 200, `style_rules: expected 200, got ${r1.status}`);
    assert.ok(r1.body.style_rules, 'style_rules response should include style_rules array');

    const r2 = await request(port, {
      method: 'GET',
      path: '/v3/translation_memories?page=0&page_size=10',
      headers: { 'mock-server-session': 'helpers-coerce-handler-2' },
    });
    assert.strictEqual(r2.status, 200, `translation_memories: expected 200, got ${r2.status}`);
    assert.ok(r2.body.translation_memories, 'translation_memories response should include translation_memories array');

    // Defaults path (no query params) should also succeed.
    const r3 = await request(port, {
      method: 'GET',
      path: '/v3/style_rules',
      headers: { 'mock-server-session': 'helpers-coerce-handler-3' },
    });
    assert.strictEqual(r3.status, 200, `style_rules (defaults): expected 200, got ${r3.status}`);

    // Boundary: page_size at the max allowed value (25) — exercises the
    // top of the allowedValues array. Pre-fix, the handler held
    // ['1'..'25'] (strings) and includes(25) (coerced number) would fail.
    const r4 = await request(port, {
      method: 'GET',
      path: '/v3/style_rules?page=0&page_size=25',
      headers: { 'mock-server-session': 'helpers-coerce-handler-4' },
    });
    assert.strictEqual(r4.status, 200, `style_rules page_size=25 (boundary): expected 200, got ${r4.status}`);

    // Out-of-range: page_size=26 must STILL be rejected (validator's
    // schema maximum is 25). Confirms we didn't accidentally make the
    // handler accept-anything.
    const r5 = await request(port, {
      method: 'GET',
      path: '/v3/style_rules?page=0&page_size=26',
      headers: { 'mock-server-session': 'helpers-coerce-handler-5' },
    });
    assert.ok(
      r5.status >= 400 && r5.status < 500,
      `style_rules page_size=26 (out of range): expected 4xx, got ${r5.status}`,
    );

    console.log('PASS: /v3 list handlers tolerate coerced number/boolean query params');
  } finally {
    proc.kill();
    fs.unlinkSync(specFile);
  }
}

// ---------------------------------------------------------------------------
// Test 15: The default translation memory must surface lowercase language
//          codes in its GET /v3/translation_memories response — the spec's
//          TranslationMemorySourceLanguage / TranslationMemoryTargetLanguage
//          enums are lowercase-only, so VALIDATE_RESPONSES=1 would 500 on
//          any response with uppercase. Guard against regression.
// ---------------------------------------------------------------------------
async function testDefaultTranslationMemoryLowercaseLangs() {
  const port = PORT_BASE + 15;
  const proc = startServer(port);
  try {
    await waitForServer(proc);

    const r = await request(port, {
      method: 'GET',
      path: '/v3/translation_memories',
      headers: { 'mock-server-session': 'helpers-default-tm-lowercase' },
    });
    assert.strictEqual(r.status, 200, `expected 200, got ${r.status}`);
    assert.ok(Array.isArray(r.body.translation_memories) && r.body.translation_memories.length > 0,
      'expected at least one default TM');
    const tm = r.body.translation_memories[0];
    assert.strictEqual(
      tm.source_language,
      tm.source_language.toLowerCase(),
      `source_language must be lowercase, got "${tm.source_language}"`,
    );
    tm.target_languages.forEach((tgt) => {
      assert.strictEqual(
        tgt,
        tgt.toLowerCase(),
        `target_languages entries must be lowercase, got "${tgt}"`,
      );
    });

    console.log('PASS: default translation memory returns lowercase language codes');
  } finally {
    proc.kill();
  }
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function main() {
  const tests = [
    ['5xx-count default 503', test5xxCountDefault503],
    ['5xx-status override', test5xxStatusOverride],
    ['last-request captures body', testLastRequestCapture],
    ['last-request error cases', testLastRequestErrorCases],
    ['5xx applies to validation-excluded real paths', test5xxAppliesToValidationExcludedRealPaths],
    ['capture applies to validation-excluded real paths', testCaptureAppliesToValidationExcludedRealPaths],
    ['last-request bypasses 5xx', testLastRequestBypasses5xx],
    ['VALIDATE_REQUESTS catches bad body', testValidateRequestsCatchesBadBody],
    ['allow-extra-body escapes validation', testAllowExtraBodyEscapesValidation],
    ['Without VALIDATE_REQUESTS, no validation', testWithoutEnvVarNoRequestValidation],
    ['allow-extra-body bypasses only request validation', testAllowExtraBodyDoesNotBypassResponseValidation],
    ['invalid 5xx-status falls back to 503', test5xxStatusInvalidFallsBackTo503],
    ['capture handles multipart upload', testCaptureMultipartUpload],
    ['VALIDATE_REQUESTS coerces wire-format query params', testValidateRequestsCoercesQueryParams],
    ['/v3 list handlers tolerate coerced query types', testHandlersTolerateCoercedQueryTypes],
    ['default TM response uses lowercase language codes', testDefaultTranslationMemoryLowercaseLangs],
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
