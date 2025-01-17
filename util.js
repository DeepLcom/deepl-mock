// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

function cleanup(dictionary, lifetimeMs, callback) {
  const now = new Date();
  // Remove all objects with a used timestamp older than specified lifetime
  dictionary.forEach((object, id) => {
    if (now - object.used > lifetimeMs) {
      callback(object, id);
      dictionary.delete(id);
    }
  });
}

function scheduleCleanup(map, callback) {
  // Schedules a repeated check for objects older than 10min in given map, callback is called
  // for each expired object
  setInterval(() => cleanup(map, 600000, callback), 1000);
}

class HttpError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status_internal = status;
    this.detail = detail;
  }

  status() {
    return this.status_internal || 400;
  }

  body() {
    const result = {};
    if (this.message) { result.message = this.message; }
    if (this.detail) { result.detail = this.detail; }
    return result;
  }
}

// This is a simplified implementation of this conversion that won't work for all
// BCP-47 codes, but all we currently use at DeepL.
// Before further complicating this implementation, it might make sense to switch
// to a library.
function convertToBcp47(langCode) {
  let tokens = langCode.split('-');
  const numTokens = tokens.length;
  tokens = tokens.map((token, index) => {
    if (index !== 0 && index === numTokens - 1) {
      return token.toUpperCase();
    }
    return token.toLowerCase();
  });
  return tokens.join('-');
}

module.exports = { convertToBcp47, scheduleCleanup, HttpError };
