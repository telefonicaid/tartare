'use strict';

module.exports = function(collectionsGroup) {
  var timeoutCollection = collectionsGroup.createCollection('timeout/');

  return {
    read: function read(cb) {
      timeoutCollection.get('', function(err, res){
        if (err) {
          return cb(err);
        }
        cb(null, res.json.timeout);
      });
    },
    update: function update(timeout, cb) {
      timeoutCollection.put('', { timeout: timeout }, cb);
    }
  }
};
