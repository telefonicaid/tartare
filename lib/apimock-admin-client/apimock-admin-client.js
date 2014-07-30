/*

 Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U

 This file is part of Tartare.

 Tartare is free software: you can redistribute it and/or modify it under the
 terms of the Apache License as published by the Apache Software Foundation,
 either version 2.0 of the License, or (at your option) any later version.
 Tartare is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the Apache License for more details.

 You should have received a copy of the Apache License along with Tartare.
 If not, see http://www.apache.org/licenses/LICENSE-2.0

 For those usages not covered by the Apache License please contact with:
 joseantonio.rodriguezfernandez@telefonica.com

 */

'use strict';

var collections = require('../tartare').collections
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
