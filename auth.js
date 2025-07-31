// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const util = require('./util');

const users = new Map();
util.scheduleCleanup(users, (_, authKey) => {
  console.log('Removed user account for:', authKey);
});

function getBillingStartAndEnd() {
  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth())).getTime();
  const nextMonth = new Date(Date.UTC(
    now.getUTCFullYear() + (now.getUTCMonth() === 11 ? 1 : 0),
    (now.getUTCMonth() + 1) % 12,
  )).getTime();

  // Time offset: 2 days, 4 hours, 5 mins, 6 secs and 789 ms
  // Note: only 2 more days are needed to get the 3rd of the month
  const timeOffsetFromMonthStart = (((2 * 24 + 4) * 60 + 5) * 60 + 6) * 1000 + 789;

  return {
    start_time: new Date(thisMonth + timeOffsetFromMonthStart).toISOString(),
    end_time: new Date(nextMonth + timeOffsetFromMonthStart).toISOString(),
  };
}

function userExists(authKey) {
  return (authKey && authKey !== '' && authKey !== 'invalid' && users.has(authKey));
}

function createUser(authKey, session) {
  let usage = {};
  if (session?.init_char_limit !== 0) {
    usage.character_count = 0;
    usage.character_limit = session?.init_char_limit || 20000000;
    usage = { ...usage, ...getBillingStartAndEnd() };
  }
  if (session?.init_doc_limit !== 0) {
    usage.document_count = 0;
    usage.document_limit = session?.init_doc_limit || 10000;
  }
  if ((session?.init_team_doc_limit || 0) > 0) {
    usage.team_document_count = 0;
    usage.team_document_limit = session?.init_team_doc_limit;
  }

  console.log('Created user with session:', session, ' authKey:', authKey, ' usage:', usage);
  users.set(authKey, {
    authKey,
    usage,
    used: new Date(),
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
    console.debug(`Added user account for ${authKey}`);
  }
  req.user_account = users.get(authKey);
  req.user_account.used = new Date();
  return next();
};
