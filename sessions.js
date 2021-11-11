// Copyright 2021 DeepL GmbH (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const util = require('./util');

const sessions = new Map();
util.scheduleCleanup(sessions, (_, id) => {
  console.log('Removed session:', id);
});

function createSession(headers) {
  const session = {};

  const vars = {
    no_response_count: 'mock-server-session-no-response-count',
    respond_429_count: 'mock-server-session-429-count',
    doc_failure: 'mock-server-session-doc-failure',
    init_char_limit: 'mock-server-session-init-character-limit',
    init_doc_limit: 'mock-server-session-init-document-limit',
    init_team_doc_limit: 'mock-server-session-init-team-document-limit',
    doc_queue_time: 'mock-server-session-doc-queue-time',
    doc_translate_time: 'mock-server-session-doc-translate-time',
    expect_proxy: 'mock-server-session-expect-proxy',
  };

  // eslint-disable-next-line guard-for-in,no-restricted-syntax
  for (const varName in vars) {
    const headerName = vars[varName];
    if (headers[headerName] !== undefined) {
      const value = Number(headers[headerName]);
      if (Number.isNaN(value)) {
        console.log(`Invalid value for header '${headerName}', expected number.`);
      } else {
        session[varName] = value;
        console.log(`Session header '${headerName}' = ${value}.`);
      }
    }
  }

  return session;
}

module.exports = () => (req, res, next) => {
  // Middleware function applied to all incoming requests
  // Check for "mock-server-session" header. When a new UUID is found, create a new session based on
  // the "mock-server-session-" headers. If an existing UUID is found, the session is not modified.
  // The found session is attached to the request as req.session.
  const uuid = req.headers['mock-server-session'];
  if (uuid) {
    if (!sessions.has(uuid)) {
      sessions.set(uuid, createSession(req.headers));
      console.log('Created session:', uuid);
    }

    req.session = sessions.get(uuid);
    req.session.used = new Date();
  } else {
    req.session = {};
  }

  if (req.session.no_response_count > 0) {
    req.session.no_response_count -= 1;
    return undefined; // Give no response and do not continue with next handler
  }

  if (req.session.expect_proxy) {
    if (req.headers.forwarded === undefined) {
      console.log('Expected a request via proxy.');
      res.status(400).send({ message: 'Expected a request via proxy.' });
      return undefined; // Do not continue with next handler
    }
  }

  return next();
};
