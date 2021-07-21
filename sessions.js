'use strict';

const util = require('./util')

let sessions = new Map();
util.scheduleCleanup(sessions, (_, id) => {
    console.log("Removed session:", id);
});

function createSession(headers) {
    let session = {}

    const vars = {
        no_response_count: "mock-server-session-no-response-count",
        respond_429_count: "mock-server-session-429-count",
        doc_failure: "mock-server-session-doc-failure",
        init_char_limit: "mock-server-session-init-character-limit",
        init_doc_limit: "mock-server-session-init-document-limit",
        init_team_doc_limit: "mock-server-session-init-team-document-limit",
        doc_queue_time: "mock-server-session-doc-queue-time",
        doc_translate_time: "mock-server-session-doc-translate-time"
    };

    for (const var_name in vars) {
        const header_name = vars[var_name];
        if (headers[header_name] !== undefined) {
            const value = Number(headers[header_name]);
            if (isNaN(value)) {
                console.log(`Invalid value for header '${header_name}', expected number.`);
            } else {
                session[var_name] = value;
                console.log(`Session header '${header_name}' = ${value}.`);
            }
        }
    }


    return session;
}

module.exports = () => {
    return (req, res, next) => {
        // Middleware function applied to all incoming requests
        // Check for "mock-server-session" header. When a new UUID is found, create a new session based on
        // the "mock-server-session-" headers. If an existing UUID is found, the session is not modified.
        // The found session is attached to the request as req.session.
        const uuid = req.headers["mock-server-session"];
        if (uuid) {
            if (!sessions.has(uuid)) {
                sessions.set(uuid, createSession(req.headers));
                console.log("Created session:", uuid);
            }

            req.session = sessions.get(uuid);
            req.session.used = Date.now();
        } else {
            req.session = {}
        }

        if (req.session.no_response_count > 0) {
            req.session.no_response_count -= 1;
        } else {
            return next();
        }
    };
};
