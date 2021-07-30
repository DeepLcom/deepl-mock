'use strict';

const express = require('express')
const app = express()
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const nocache = require('nocache');
app.use(nocache());

const fileUpload = require('express-fileupload');
app.use(fileUpload({
    createParentPath: true
}));

const morgan = require('morgan'); // Logging utility
app.use(morgan('dev')); // Developer-style formatting

const sessions = require('./sessions')
app.use(sessions());
const languages = require('./languages')
const documents = require('./documents')
const auth = require('./auth')


function getParam(req, name, options) {
    const src = req.method === 'GET' ? req.query : req.body;
    let v = src[name];

    if (options?.multi) {
        if (v === undefined) v = [];
        v = Array.isArray(v) ? v : [v];
        if (options?.required && v.length === 0) throw `Parameter '${name}' not specified`;

    } else {
        v = Array.isArray(v) ? v[0] : v;
        if (options?.required && v === undefined) throw `Parameter '${name}' not specified`;
        else if (v === undefined) v = options?.default;

        if (options?.lower && v) v = v.toLowerCase();
        else if (options?.upper && v) v = v.toUpperCase();

        if (options?.validator && options?.validator(v) === false) throw `Value for '${name}' not supported.`
        if (options?.allowedValues && !options?.allowedValues.includes(v)) throw `Value for '${name}' not supported.`
    }

    return v;
}

function checkLimit(usage, type, request) {
    const count = type + "_count";
    const limit = type + "_limit";

    if (usage[limit] === undefined) return true;
    if (usage[count] + request > usage[limit]) return false;

    usage[count] += request;
    return true;
}

async function handle_languages(req, res) {
    try {
        const type = getParam(req, 'type', {
            default: 'source', validator: (type) => {
                if (!['source', 'target'].includes(type)) {
                    throw "Parameter 'type' is invalid. 'source' and 'target' are valid values.";
                }
            }
        });

        if (type === 'target') {
            res.send(languages.getTargetLanguages())
        } else {
            res.send(languages.getSourceLanguages())
        }
    } catch (err) {
        res.status(400).send({message: err});
    }
}

async function handle_usage(req, res) {
    res.send(req.user_account.usage);
}

async function handle_translate(req, res) {
    try {
        const target_lang = getParam(req, 'target_lang', {
            upper: true, validator: languages.isTargetLanguage
        });
        const source_lang = getParam(req, 'source_lang', {
            upper: true, validator: languages.isSourceLanguage
        });
        const textArray = getParam(req, 'text', {multi: true, required: true});

        // The following parameters are validated but not used by the mock server
        getParam(req, 'formality', {
            default: "default", allowedValues: ["less", "more", "default"]
        });
        getParam(req, 'tag_handling', {default: "xml", allowedValues: ["xml"]});
        getParam(req, 'outline_detection', {default: "0", allowedValues: ["0"]});

        // Calculate the character count of the requested translation
        const totalCharacters = textArray.reduce((total, text) => (total + text.length), 0);

        // Check if session is configured to respond with 429: too-many-requests
        if (req.session.respond_429_count > 0) {
            req.session.respond_429_count -= 1;
            res.status(429).send();
        } else {
            if (!checkLimit(req.user_account.usage, "character", totalCharacters)) {
                res.status(456).send({message: "Quota for this billing period has been exceeded."});
            } else {
                const body = {
                    translations: textArray.map((text) => languages.translate(text, target_lang, source_lang))
                };
                res.status(200).send(body);
            }
        }
    } catch (err) {
        res.status(400).send({message: err});
    }
}

async function handle_document(req, res) {
    try {
        const target_lang = getParam(req, 'target_lang', {
            upper: true, validator: languages.isTargetLanguage
        });
        const source_lang = getParam(req, 'source_lang', {
            upper: true, validator: languages.isSourceLanguage
        });
        const auth_key = req.user_account.auth_key;

        if (!req.files || req.files.file === undefined) {
            res.status(400).send({message: "Invalid file data."});
        } else {
            const file = req.files.file;
            try {
                // Mock server simplification: billed characters assumed to be file size
                const totalCharacters = file.size;
                if (!checkLimit(req.user_account.usage, "character", totalCharacters) ||
                    !checkLimit(req.user_account.usage, "document", 1) ||
                    !checkLimit(req.user_account.usage, "team_document", 1)) {
                    res.status(456).send({message: "Quota for this billing period has been exceeded."});
                } else {
                    const document = await documents.createDocument(file, auth_key, target_lang, source_lang);
                    res.status(200).send({
                        document_id: document.id,
                        document_key: document.key
                    });
                    await documents.translateDocument(document, req.session);
                }
            } catch (err) {
                res.status(err.status).send({message: err.message});
            }
        }
    } catch (err) {
        res.status(400).send({message: err});
    }
}

async function handle_document_status(req, res) {
    try {
        const auth_key = getParam(req, 'auth_key', {single: true});
        const document_key = getParam(req, 'document_key', {single: true});
        const document = documents.getDocument(req.params.document_id, document_key, auth_key, req.session);

        let body = {
            document_id: document.id,
            status: document.status,
        }

        if (document.status === 'translating') {
            body.seconds_remaining = document.seconds_remaining;
        } else if (document.status === 'done') {
            body.seconds_remaining = document.seconds_remaining;
            body.billed_characters = document.billed_characters;
        }

        res.status(200).send(body)
    } catch {
        res.status(404).send();
    }
}

async function handle_document_download(req, res) {
    try {
        const auth_key = getParam(req, 'auth_key', {single: true});
        const document_key = getParam(req, 'document_key', {single: true});
        const document = documents.getDocument(req.params.document_id, document_key, auth_key, req.session);

        if (document.status !== 'done') {
            res.status(503).send();
        } else {
            res.status(200);
            res.download(document.path_out, document.name, (err) => {
                if (err) {
                    console.log(`Error occurred during file download: ${err}`);
                } else {
                    documents.removeDocument(document);
                }
            });
        }
    } catch {
        res.status(404).send();
    }
}

app.get('/v2/languages', auth, handle_languages);
app.post('/v2/languages', auth, handle_languages);

app.get('/v2/usage', auth, handle_usage);
app.post('/v2/usage', auth, handle_usage);

app.get('/v2/translate', auth, handle_translate);
app.post('/v2/translate', auth, handle_translate);

app.post('/v2/document', auth, handle_document);

app.get('/v2/document/:document_id', auth, handle_document_status);
app.post('/v2/document/:document_id', auth, handle_document_status);

app.get('/v2/document/:document_id/result', auth, handle_document_download);
app.post('/v2/document/:document_id/result', auth, handle_document_download);

app.all('/*', (req, res) => {
    res.status(404).send();
})

const envvar_port = "DEEPL_MOCK_SERVER_PORT"
const port = Number(process.env[envvar_port])
if (isNaN(port)) {
    console.error(`The ${envvar_port} environment variable must be defined as the port number.`);
    process.exit(2);
}

app.listen(port, () => {
    console.log(`DeepL API mock-server listening at http://localhost:${port}`);
}).on("error", (error) => {
    console.error(`Error occurred while starting the server: ${error}`);
    process.exit(1);
})
