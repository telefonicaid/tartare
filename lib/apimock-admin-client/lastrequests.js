'use strict';

module.exports = function(collectionsGroup) {
  var lastRequestsCollection = collectionsGroup.createCollection('lastrequests/');

  return {
    read: function read(filter, cb) {
      if (filter instanceof Function && cb === undefined) {
        cb = filter;
        filter = null;
      }
      lastRequestsCollection.get(filter, function(err, res) {
        if (err) {
          return cb(err);
        }
        if (res.statusCode !== 200) {
          return cb(err, res);
        }
        // Decode body from Base64 to Buffer when it is binary
        res.json.forEach(function(lastRequest) {
          if (lastRequest.binaryBody) {
            lastRequest.body = new Buffer(lastRequest.body, 'base64');
          }
        });
        cb(err, res);
      });
    },
    del: function del(filter, cb) {
      if (filter instanceof Function && cb === undefined) {
        cb = filter;
        filter = null;
      }
      lastRequestsCollection.del(filter, cb);
    }
  }
};
