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

/**
 * This module models generic REST API collections,
 * understood as resources (developers, applications, users, etc.),
 * exporting basic operations: post, get, put, delete, patch.
 *
 */
var request = require('request')
  , qs = require('querystring')
  , tartareHttp = require('./http')
  ;

/**
 * This class models a group of generic collections, that is, collections
 * that share a common configuration such as baseUrl, authorization credentials,
 * etc. It normally applies to collections hanging of a common baseUrl in the
 * same server. It is initialized with a config object with the following fields:
 * - baseUrl: Base URL shared by all the collection belonging to the group.
 *   Eg: https://api.server.com/provision/v1/
 * - auth (optional): HTTP Basic Auth credentials, in the form of an object with
 *   two fields: user and pass.
 *   Eg: { user: 'john.doe', pass: 'secret' }
 * - headers: object containing headers to be sent for all requests to this group.
 * - timeout: HTTP client timeout to be used by default for requests to this group.
 * - Any other options supported by request, http or https modules.
 *
 * @param config
 */
var ApiCollectionsGroup = function ApiCollectionsGroup(config) {
  config = config || {};
  config.headers = config.headers || {};
  config.followRedirect = config.followRedirect || false;

  /**
   * This class models an specific collection, once customized to behave
   * as a developers collection, a users collection, etc.
   *
   * @param collectionPath Path representing the collection. Eg: developers/
   */
  var Collection = function Collection(collectionPath) {
    var self = this;
    self.colPath = collectionPath;
    var baseUrl = config.baseUrl + (config.baseUrl.endsWith('/') ? '' : '/') +
                  (collectionPath.endsWith('/') ? collectionPath.slice(0, -1) : collectionPath);

    /**
     * Private function to build and send an HTTP request in the context of a REST API
     *
     * @param method HTTP method.
     * @param criteria Object containing fields to be used as a search criteria. Eg: { name: 'John Doe' }
     *                 It also supports a String, which is appended to the url as a resource identifier.
     * @param body Object or String to be sent as body. If Object, body will be the JSON representation of that object.
     * @param opt Object with HTTP options (will override the config object in case of conflict). Valid values:
     *              - auth: object { user: 'john.doe', pass: 'secret' } to be used for this request.
     *              - headers: object containing HTTP headers.
     *              - timeout: HTTP client timeout.
     *              - Any other option supported by request, or http, or https modules.
     * @param cb
     * @private
     */
    var _apiRequest = function _apiRequest(method, criteria, body, opt, cb) {
      if (!cb && (opt instanceof Function)) {
        cb = opt;
        opt = null;
      }

      opt = opt || {};
      opt.method = method;
      opt.headers = opt.headers || {};
      // Merge headers, giving precedence to opt.headers over config.headers
      var lowerCasedOptHeaders = tartareHttp.lowerCaseHeaders(opt.headers);
      for (var headerName in config.headers) {
        if (config.headers.hasOwnProperty(headerName)) {
          if (!lowerCasedOptHeaders.hasOwnProperty(headerName.toLowerCase())) {
            opt.headers[headerName] = config.headers[headerName];
          }
        }
      }
      // Remove headers with value null
      for (headerName in opt.headers) {
        if (opt.headers.hasOwnProperty(headerName) && opt.headers[headerName] === null) {
          delete opt.headers[headerName];
        }
      }

      // Set query parameters (if criteria is an object), or append criteria to the uri as a resource identifier
      criteria = criteria || '';
      if (criteria instanceof Object) {
        if (Array.isArray(criteria)) {
          criteria = criteria.map(function(criterion) {
            return qs.escape(criterion);
          });
          opt.uri = baseUrl + (criteria ? '/' + criteria.join('/') : '');
        } else {
          criteria = qs.stringify(criteria);
          opt.uri = baseUrl + (criteria ? '?' + criteria : '');
        }
      } else {
        opt.uri = baseUrl + (criteria ? '/' + qs.escape(criteria) : '');
      }

      // Set a default Accept header in case none has been set
      if (!opt.headers['accept']) {
        opt.headers['accept'] = 'application/json';
      }

      if (body) {
        // If there is no a Content-Type header, set a default one based on the HTTP method
        if (!opt.headers['content-type']) {
          switch (method) {
            case 'POST':
            case 'PUT':
              opt.headers['content-type'] = 'application/json';
              break;
            case 'PATCH':
              opt.headers['content-type'] = 'application/json-patch+json';
              break;
          }
        }

        // Set the body
        if (typeof(body) === 'string') {
          opt.body = body;
        } else {
          opt.body = JSON.stringify(body);
        }
      }

      // Get any other property from config object and not already set in opt object
      for (var optName in config) {
        if (config.hasOwnProperty(optName) && optName !== 'baseUrl') {
          if (!opt[optName]) {
            opt[optName] = config[optName];
          }
        }
      }

      request(opt, function handleResponse(err, res, body) {
        if (err) {
          //console.log('err:', err);
          return cb(err);
        }

        // Response object will have two properties:
        //  - body, containing the body as a string.
        //  - json, the parsed version of the body, in case the body contains a JSON document.

        // If Content-Type is application/json, try to parse the body and assign the parsed object to res.json
        if (res.headers['content-type'] && res.headers['content-type'].split(';')[0] === 'application/json') {
          try {
            res.json = JSON.parse(res.body);
          } catch (err) {}
        }

        //console.log('Request URI:', res.req.method, res.req.path);
        //console.log('Request body:', opt.body);
        //console.log('Response statusCode:', res.statusCode);
        //console.log('Response body:', res.body);
        //console.log('Response JSON body:', res.json);
        cb(null, res);
      });
    };

    return {
      post: function post(body, opt, cb) {
        _apiRequest('POST', null, body, opt, cb);
      },
      shortcut: function shortcut(criteria, body, opt, cb) {
        _apiRequest('POST', criteria, body, opt, cb);
      },
      get: function get(criteria, opt, cb) {
        _apiRequest('GET', criteria, null, opt, cb);
      },
      put: function put(criteria, body, opt, cb) {
        _apiRequest('PUT', criteria, body, opt, cb);
      },
      del: function del(criteria, opt, cb) {
        _apiRequest('DELETE', criteria, null, opt, cb);
      },
      patch: function patch(criteria, body, opt, cb) {
        _apiRequest('PATCH', criteria, body, opt, cb);
      }
    }
  };

  return {
    /**
     * Creates and return a new instance of an specific collection
     */
    createCollection: function createCollection(path, id) {
      return new Collection(path, id);
    }
  }
};

module.exports = {
  createCollectionsGroup: function createCollectionsGroup(config) {
    return new ApiCollectionsGroup(config);
  }
};
