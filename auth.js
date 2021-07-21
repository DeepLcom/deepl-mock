'use strict';

const util = require('./util')

let users = new Map();
util.scheduleCleanup(users, (_, auth_key) => {
    console.log("Removed user account for:", auth_key);
});

function userExists(auth_key) {
    return (auth_key && auth_key !== "" && auth_key !== "invalid" && users.has(auth_key));
}

function createUser(auth_key, session) {
    let usage = {};
    console.log("Creating user with session:", session)
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
    console.log("Usage:", usage)

    users.set(auth_key, {
        auth_key: auth_key,
        usage: usage,
        used: Date.now(),
    });
}

module.exports = (req, res, next) => {
    // Middleware function applied to all incoming requests
    // Check for auth_key param and compare against user list
    let auth_key = req.query.auth_key || req.body.auth_key;
    auth_key = Array.isArray(auth_key) ? auth_key[0] : auth_key;

    if (auth_key === undefined || auth_key === "" || auth_key === "invalid") {
        res.status(403).send();
        return;
    } else if (!userExists(auth_key)) {
        createUser(auth_key, req.session);
        console.log(`Added user account for ${auth_key}`)
    }
    req.user_account = users.get(auth_key);
    req.user_account.used = Date.now();
    return next();
};
