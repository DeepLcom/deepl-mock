// Copyright 2021 DeepL GmbH (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const util = require('./util');

const users = new Map();
util.scheduleCleanup(users, (_, authKey) => {
  console.log('Removed user account for:', authKey);
});

function userExists(authKey) {
  return (authKey && authKey !== '' && authKey !== 'invalid' && users.has(authKey));
}

function createUser(authKey, session) {
  const usage = {};
  console.log('Creating user with session:', session);
  if (session?.init_char_limit !== 0) {
    usage.character_count = 0;
    usage.character_limit = session?.init_char_limit || 20000000;
  }
  if (session?.init_doc_limit !== 0) {
    usage.document_count = 0;
    usage.document_limit = session?.init_doc_limit || 10000;
  }
  if ((session?.init_team_doc_limit || 0) > 0) {
    usage.team_document_count = 0;
    usage.team_document_limit = session?.init_team_doc_limit;
  }
  console.log('Usage:', usage);

  users.set(authKey, {
    authKey,
    usage,
    used: Date.now(),
  });
}

function getAuthKey(req) {
  // Check for Authorization header
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader !== undefined) {
    const prefixHeaderAuthKey = 'DeepL-Auth-Key ';
    if (authorizationHeader.startsWith(prefixHeaderAuthKey)) {
      return authorizationHeader.substring(prefixHeaderAuthKey.length);
    }
    console.log(`Received Authorization header without expected prefix (${prefixHeaderAuthKey}): ${authorizationHeader}`);
    // Note: glossaries endpoints respond 400/{message:"Invalid or missing Authorization header"}
    return undefined;
  }
  // If no Authorization header is included, fall back to query or body parameters
  const authKeyParam = req.query.auth_key || req.body.auth_key;
  return Array.isArray(authKeyParam) ? authKeyParam[0] : authKeyParam;
}

module.exports = (req, res, next) => {
  // Middleware function applied to all incoming requests
  const authKey = getAuthKey(req);

  if (authKey === undefined || authKey === '' || authKey === 'invalid') {
    res.status(403).send();
    return undefined; // Give no response and do not continue with next handler
  }

  if (!userExists(authKey)) {
    createUser(authKey, req.session);
    console.log(`Added user account for ${authKey}`);
  }
  req.user_account = users.get(authKey);
  req.user_account.used = Date.now();
  return next();
};
