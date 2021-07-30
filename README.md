# DeepL API mock server
A mock server that simulates some behaviour of the [DeepL API](https://www.deepl.com/docs-api/) to simplify application
testing.

## Installation
This server uses Node.js. After [installing Node.js](https://nodejs.dev/learn/how-to-install-nodejs), install the
required packages using [NPM](https://www.npmjs.com/):
```shell
npm install
```

## Usage
To run the server listening on the default port (3000):
```shell
npm start
```
The **DEEPL_MOCK_SERVER_PORT** environment variable may be used to specify a different port:
```shell
export DEEPL_MOCK_SERVER_PORT=3001
node index.js
```

## Server configuration via HTTP-request header
The HTTP-request header **mock-server-session** may be sent with any request, containing a unique string identifying the
test session. A session identifier could be, for example, a test-case name and UUID.

When the server receives an unrecognized session identifier, it creates a new session and uses the session headers
(listed in the table below) to configure the session. These settings affect all requests in that session. Note that
once created, sessions cannot be reconfigured.

The server removes sessions after 10 minutes of inactivity.

|Header field |Type  | Description|
| :--- | :--- | :--- |
|mock-server-session|Any|Uniquely identifies this test session.|
|mock-server-session-no-response-count|Integer|Specifies the number of requests that should result in no response before resuming normal behavior.|
|mock-server-session-429-count|Integer|Specifies the number of **/translate** requests that should result in a **429 Too Many Requests** response before resuming normal behavior.|
|mock-server-session-doc-failure|Integer|Specifies the number of documents that should fail during translation before resuming normal behavior.|
|mock-server-session-init-character-limit|Integer|Specifies the character limit for user accounts created in this session, specify 0 to remove limit. Default: 20000000.|
|mock-server-session-init-document-limit|Integer|Specifies the document limit for user accounts created in this session, specify 0 to remove limit. Default: 10000.|
|mock-server-session-init-team-document-limit|Integer|Specifies the team document limit for user accounts created in this session. Default: no limit.|
|mock-server-session-doc-queue-time|Integer|Specifies the time in milliseconds that documents are queued before being translated.|
|mock-server-session-doc-translate-time|Integer|Specifies the time in milliseconds that documents take to translate.|

## Limitations compared with the DeepL API
### Limited translation
The real DeepL API can accurately translate arbitrary text, however this mock server can only translate the test
phrase "proton beam" among the DeepL-supported languages, and multi-line text where each line contains the phrase
"proton beam". The translation functions will check the desired target language and respond with the corresponding
translation of "proton beam", regardless of the input text. 

Additionally, this mock server cannot auto-detect the source language, unless it matches one of the test phrase
translations. Otherwise, the source language is assumed to be English.

### User accounts
This server creates a new user account whenever it receives a request with an unrecognized **auth_key**. To test
behaviour due to an incorrect key use either an empty key, or the value "invalid". The server removes user accounts
after 10 minutes of inactivity.

### Only .txt files
This mock server only supports .txt files for document translation. The DeepL API additionally supports .docx, .pptx
and .html/.htm files. The server removes documents after 10 minutes of inactivity.

### Account usage
This mock server uses simplified calculations to update account usage. 

### Formality, tag-handling, formatting 
This mock server does not implement these features, however the API input parameters are validated.

## Issues
If you experience problems using the library, or would like to request a new feature, please create an 
[issue](https://www.github.com/DeepLcom/deepl-mock/issues). 
