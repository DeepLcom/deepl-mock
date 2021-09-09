// Copyright 2021 DeepL GmbH (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

function cleanup(dictionary, lifetimeMs, callback) {
  const now = Date.now();
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

module.exports = { scheduleCleanup, HttpError };
