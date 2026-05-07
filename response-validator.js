// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const DEFAULT_SPEC_URL = 'https://raw.githubusercontent.com/DeepLcom/openapi/main/openapi.yaml';

// Routes that should bypass response validation. Each pattern is matched
// against req.path with RegExp#test. Each entry is here for one of three
// reasons:
//   - mock-only / not part of the real DeepL API
//   - response shape conflicts with the validator (multipart upload, binary
//     download stream)
//   - served by PROD but not yet in the spec
const IGNORED_PATHS = [
  /^\/v2\/translate_secondary$/, // mock-only test-helper route
  /^\/v2\/document$/, // multipart upload — incompatible with the validator
  // Binary download streamed via res.download(); the validator would try to
  // parse the Buffer body against the JSON schema and false-positive.
  /^\/v2\/document\/[^/]+\/result$/,
  /^\/healthz$/, // mock-only liveness endpoint
  /^\/v3\/languages$/, // served by PROD, not in spec
  /^\/v3\/languages\/products$/, // served by PROD, not in spec
];

async function loadSpecText() {
  const { DEEPL_MOCK_SPEC_URL: specUrl, DEEPL_MOCK_SPEC_PATH: specPath } = process.env;

  if (specUrl && specPath) {
    throw new Error(
      'DEEPL_MOCK_SPEC_URL and DEEPL_MOCK_SPEC_PATH are mutually exclusive — set only one.',
    );
  }

  if (specPath) {
    const fs = require('fs/promises'); // eslint-disable-line global-require
    try {
      return await fs.readFile(specPath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read OpenAPI spec from ${specPath}: ${err.message}`);
    }
  }

  const url = specUrl || DEFAULT_SPEC_URL;
  try {
    const response = await fetch(url); // eslint-disable-line no-undef
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (err) {
    throw new Error(
      `Failed to fetch OpenAPI spec from ${url}: ${err.message}`
        + '. VALIDATE_RESPONSES=1 requires the spec to be reachable.',
    );
  }
}

/**
 * Installs express-openapi-validator response-validation middleware on the
 * given Express app when the VALIDATE_RESPONSES environment variable is set
 * to "1".  The middleware loads the OpenAPI spec at startup, validates every
 * response body strictly, and lets unknown request headers / query parameters
 * through (they are test infrastructure, not part of the spec).
 *
 * Spec source (pick one; defaults to the public DeepL spec on GitHub):
 *   - DEEPL_MOCK_SPEC_URL   — fetch spec from this URL
 *   - DEEPL_MOCK_SPEC_PATH  — read spec from this local file
 *
 * Mock-only routes (paths that only exist in deepl-mock, not in the real
 * DeepL API) are excluded via ignorePaths so the validator does not interfere
 * with them.
 */
async function installResponseValidator(app) {
  if (process.env.VALIDATE_RESPONSES !== '1') {
    return;
  }

  // Lazy: only load when validation is enabled, keeps deps out of default startup.
  const yaml = require('js-yaml'); // eslint-disable-line global-require
  const OpenApiValidator = require('express-openapi-validator'); // eslint-disable-line global-require

  console.log('Loading OpenAPI spec for response validation...');
  const specText = await loadSpecText();
  let apiSpec;
  try {
    apiSpec = yaml.load(specText);
  } catch (err) {
    // Catches the case where the spec source returned HTTP 200 but with
    // non-YAML content (e.g. an HTML redirect/error page). yaml.load's
    // YAMLException alone makes this hard to diagnose.
    throw new Error(
      `Failed to parse OpenAPI spec as YAML: ${err.message}`
        + '. Check that DEEPL_MOCK_SPEC_URL/DEEPL_MOCK_SPEC_PATH points at a YAML document.',
    );
  }

  app.use(
    OpenApiValidator.middleware({
      apiSpec,
      validateApiSpec: false,
      validateRequests: false,
      validateResponses: true,
      ignorePaths: (p) => IGNORED_PATHS.some((re) => re.test(p)),
    }),
  );

  console.log('Response validation enabled against OpenAPI spec.');
}

/**
 * Express error handler that surfaces response-validation failures as
 * structured JSON including the specific field and schema that failed.
 */
function validationErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err.status && err.errors) {
    console.error(
      `Response validation error on ${req.method} ${req.path}:`,
      JSON.stringify(err.errors, null, 2),
    );
    res.status(err.status).json({
      message: err.message,
      errors: err.errors,
    });
  } else {
    next(err);
  }
}

module.exports = { installResponseValidator, validationErrorHandler };
