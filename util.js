function cleanup(dictionary, lifetime_ms, callback) {
  const now = Date.now();
  // Remove all objects with a used timestamp older than specified lifetime
  dictionary.forEach((object, id) => {
    if (now - object.used > lifetime_ms) {
      callback(object, id);
      dictionary.delete(id);
    }
  });
}

function scheduleCleanup(map, callback) {
  // Schedules a repeated check for objects older than 10min in given map, callback is called for each expired object
  setInterval(() => cleanup(map, 600000, callback), 1000);
}

module.exports = { scheduleCleanup };
