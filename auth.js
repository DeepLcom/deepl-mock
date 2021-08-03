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

module.exports = (req, res, next) => {
  // Middleware function applied to all incoming requests
  // Check for auth_key param and compare against user list
  let authKeyParam = req.query.auth_key || req.body.auth_key;
  authKeyParam = Array.isArray(authKeyParam) ? authKeyParam[0] : authKeyParam;

  if (authKeyParam === undefined || authKeyParam === '' || authKeyParam === 'invalid') {
    res.status(403).send();
    return undefined; // Give no response and do not continue with next handler
  }

  if (!userExists(authKeyParam)) {
    createUser(authKeyParam, req.session);
    console.log(`Added user account for ${authKeyParam}`);
  }
  req.user_account = users.get(authKeyParam);
  req.user_account.used = Date.now();
  return next();
};
