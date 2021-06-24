'use strict';

const fs = require("fs");
const path = require("path");
const languages = require('./languages');

let documents = new Map();

function cleanup() {
    const now = Date.now();
    // Remove all documents that have not been used for 10min
    documents.forEach((document, document_id) => {
        if (now - document.used > 600000) {
            if (document.path_in) {
                try {
                    fs.unlinkSync(document.path_in)
                } catch (err) {
                    // ignore
                }
            }
            if (document.path_out) {
                try {
                    fs.unlinkSync(document.path_out)
                } catch (err) {
                    // ignore
                }
            }
            documents.delete(document_id);
            console.log("Removed document:", document_id);
        }
    });
}

setInterval(cleanup, 1000); // Time in milliseconds

function generateRandomHexString(length) {
    const hex = '0123456789ABCDEF';
    let output = '';
    for (let i = 0; i < length; ++i) {
        output += hex.charAt(Math.floor(Math.random() * 16));
    }
    return output;
}

async function createDocument(file, auth_key, target_lang, source_lang) {
    const extname = path.extname(file.name).toLowerCase();

    if (!([".txt", ".docx", ".pptx", ".htm", ".html"].includes(extname))) {
        throw {status: 400, message: "Invalid file data."};
    }
    if (extname !== ".txt") {
        throw {status: 503, message: "Mock server only implements document translation for .txt files."}
    }

    // Generate id & key for document
    const document_id = generateRandomHexString(32);
    const document_key = generateRandomHexString(64);
    const path_in = './documents/' + document_id;

    await file.mv(path_in);

    // Add document to list
    const document = {
        id: document_id,
        key: document_key,
        path_in: path_in,
        path_out: undefined,
        name: file.name,
        mimetype: file.mimetype,
        created: Date.now(),
        used: Date.now(),
        auth_key: auth_key,
        source_lang: source_lang,
        target_lang: target_lang,
        // Mock server simplification: billed characters assumed to be file size
        billed_characters: file.size,
        status: "queued",
        seconds_remaining: undefined,
        error: undefined
    }
    documents.set(document_id, document);
    console.log("Storing document " + document_id + " (key: " + document_key + ")");
    return document;
}

function getDocument(document_id, document_key, auth_key, session) {
    let document = documents.get(document_id);
    if (document !== undefined && document.key === document_key && document.auth_key === auth_key) {
        const queued_until = session?.doc_queue_time || 0;
        const translating_until = (session?.doc_translate_time || 0) + queued_until;
        document.used = Date.now();
        const age = document.used - document.created;
        if (document.error) {
            document.status = "error";
        } else if (age < queued_until) {
            document.status = "queued";
        } else if (age < translating_until || document.path_out === undefined) {
            document.status = "translating";
            document.seconds_remaining = Math.max(translating_until - age, 0) / 1000;
        } else {
            document.status = "done";
            document.seconds_remaining = 0;
        }

        return document;
    } else {
        throw "not found";
    }
}

async function translateDocument(document, session) {
    const path_in = document.path_in;
    const path_out = path_in + ".result";
    if (session?.doc_failure > 0) {
        session.doc_failure -= 1;
        document.error = "Translation error triggered";
        console.log(`Failing translation of ${path_in}`)
    } else {
        const text_in = String(fs.readFileSync(path_in));
        const text_out = languages.translate(text_in, document.target_lang, document.source_lang);
        fs.writeFileSync(path_out, text_out.text);
        document.path_out = path_out;
        console.log(`Translated ${path_in} to ${document.target_lang}, stored result at ${path_out}`);
    }
    console.log(`Removing input document ${path_in}`);
    fs.unlinkSync(path_in);
}

function removeDocument(document) {
    console.log("Removing output document " + document.path_out);
    fs.unlinkSync(document.path_out);

    documents.delete(document.id);
}

module.exports = {createDocument, getDocument, translateDocument, removeDocument}