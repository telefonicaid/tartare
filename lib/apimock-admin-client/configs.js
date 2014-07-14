'use strict';

module.exports = function(collectionsGroup) {
  var configsCollection = collectionsGroup.createCollection('configs/');

  return {
    create: function create(config, cb) {
      var _config = config;
      // Encode body to Base64 when it is binary
      if (config.response.binaryBody && Buffer.isBuffer(config.response.body)) {
        _config = require('node.extend')(true, {}, config);
        _config.response.body = config.response.body.toString('base64');
      }
      configsCollection.post(_config, cb);
    },
    read: function read(filter, cb) {
      if (filter instanceof Function && cb === undefined) {
        cb = filter;
        filter = null;
      }
      configsCollection.get(filter, function(err, res) {
        if (err) {
          return cb(err);
        }
        if (res.statusCode !== 200) {
          return cb(err, res);
        }
        // Decode body from Base64 to Buffer when it is binary
        if (Array.isArray(res.json)) {
          res.json.forEach(function(config) {
            if (config.response.binaryBody) {
              config.response.body = new Buffer(config.response.body, 'base64');
            }
          });
        } else {
          if (res.json.response.binaryBody) {
            res.json.response.body = new Buffer(res.json.response.body, 'base64');
          }
        }
        cb(err, res);
      });
    },
    del: function del(filter, cb) {
      if (filter instanceof Function && cb === undefined) {
        cb = filter;
        filter = null;
      }
      configsCollection.del(filter, cb);
    }
  }
};
