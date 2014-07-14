'use strict';

var collections = require('../tdaf-node-tartare').collections
  , configs = require('./configs')
  , lastRequests = require('./lastrequests')
  , timeout = require('./timeout')
  ;

var ApiMockAdminClient = function ApiMockAdminClient(config) {
  var _collectionsGroup = collections.createCollectionsGroup(config);

  return {
    configs: configs(_collectionsGroup),
    timeout: timeout(_collectionsGroup),
    lastRequests: lastRequests(_collectionsGroup)
  }

};

module.exports = {
  createClient: function createClient(hostname, adminPort) {
    var config = {
      baseUrl: 'http://' + hostname + ':' + adminPort + '/admin/v1'
    };
    return new ApiMockAdminClient(config);
  }
};
