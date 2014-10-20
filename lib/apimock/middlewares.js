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

var jsonschema = require('jsonschema')
  , mustache = require('mustache')
  , url = require('url')
  , iconv = require('iconv-lite')
  , _ = require('underscore')
  , extend = require('node.extend')
  , schemas = require('./json-schemas')
  , xml2json = require('xml2json')
  , utils = require('../utils')
  ;

/**
 * Build the Location header value from an http request object and the resource id.
 *
 * @param req
 * @param _id
 * @returns {string}
 * @private
 */
function _buildLocation(req, _id) {
  var location = req.protocol + '://' + req.host;
  if ((!req.secure && req.app.settings.port !== 80) || (req.secure && req.app.settings.port !== 443)) {
    location += ':' + req.app.settings.port;
  }
  location += req.path.endsWith('/') ? req.path : req.path + '/';
  location += _id;
  return location;
}

/**
 * Retrieve the charset that is included in the content-type header value
 * @param value
 * @returns {string}
 * @private
 */
function _extractCharset(value) {
  if (!value) {
    return null;
  }
  var regexp = /^.*;\s*charset=["']?([A-Za-z0-9\-_.:()]+)["']?(?:;.*)*$/i;
  var matches = value.match(regexp);
  return (matches ? matches[1].toLowerCase() : null);
}

/**
 * Build a custom Request object from the original http request object.
 * It also get the HTTP request body.
 * This Request object will be stored in the list of last requests.
 *
 * @param req
 * @param config
 * @param cb
 * @private
 */
function _buildRequestObject(req, config, cb) {
  var parsedUrl = url.parse(req.url, true);
  var requestObj = {
    method: req.method,
    requestUri: req.url,
    path: parsedUrl.pathname,
    query: parsedUrl.query,
    headers: req.headers
  };

  requestObj.charset = _extractCharset(req.headers['content-type']);
  requestObj.chunked = (req.headers['transfer-encoding'] ? req.headers['transfer-encoding'].toLowerCase() === 'chunked' : false);

  // Get remote IP and port
  requestObj.connection = {
    remoteAddress: req.connection.remoteAddress,
    remotePort: req.connection.remotePort
  };

  // Get remote certificate
  if (req.connection.getPeerCertificate) {
    var certificate = req.connection.getPeerCertificate();
    if (certificate && Object.keys(certificate).length) {
      requestObj.certificate = certificate;
    }
  }

  var chunks = [];

  req.on('data', function(chunk) {
    chunks.push(chunk);
  });

  req.on('end', function() {
    var bodyBuffer = Buffer.concat(chunks);
    if (!config.binaryBody) {
      requestObj.body = iconv.decode(bodyBuffer, requestObj.charset || 'utf-8');
      requestObj.binaryBody = false;
      try {
        // Try to parse the body as a JSON document
        requestObj.bodyJson = JSON.parse(requestObj.body);
      } catch(err) {
        try {
          // Try to parse the body as an XML document
          requestObj.bodyJson = xml2json.toJson(requestObj.body, { object: true, coerce: false, sanitize: false });
        } catch(err) {}
      }
    } else {
      requestObj.body = bodyBuffer.toString('base64');
      requestObj.binaryBody = true;
    }
    cb(null, requestObj);
  });

  req.on('error', function(err) {
    cb(err);
  });
}

function _sendError(res, msg) {
  res.writeHead(500);
  res.end(JSON.stringify({ error: msg }));
}

/**
 * Insert a new document in the passed datastore. In case the doc already exists (repeated method and path),
 * it is deleted and the new one is inserted.
 *
 * @param datastore
 * @param doc
 * @param cb
 * @private
 */
var _insertOverwriting = function _insertOverwriting(datastore, doc, cb) {
  datastore.findOne({ method: doc.method, path: doc.path }, function(err, foundDoc) {
    if (err) {
      return cb(err);
    }
    if (foundDoc !== null) {
      datastore.remove({ _id: foundDoc._id }, {}, function(err, numRemoved) {
        if (err) {
          return cb(err);
        }
      });
    }
    datastore.insert(doc, function(err, newDoc) {
      if (err) {
        return cb(err);
      }
      cb(null, newDoc);
    });
  });
};

/**
 * Convert headers to its JSON representation, since nedb does not allow keys (header names) to have dots.
 *
 * @param config
 * @private
 */
function _marshallConfig(config) {
  if (Array.isArray(config)) {
    config.forEach(function(oneConfig) {
      if (oneConfig.response.headers) {
        oneConfig.response.headers = JSON.stringify(oneConfig.response.headers);
      }
    });
  } else {
    if (config.response.headers) {
      config.response.headers = JSON.stringify(config.response.headers);
    }
  }
  return config;
}

/**
 * Convert headers from JSON to its javascript object representation
 *
 * @param config
 * @private
 */
function _unmarshallConfig(config) {
  if (Array.isArray(config)) {
    config.forEach(function(oneConfig) {
      if (oneConfig.response.headers) {
        oneConfig.response.headers = JSON.parse(oneConfig.response.headers);
      }
    });
  } else {
    if (config.response.headers) {
      config.response.headers = JSON.parse(config.response.headers);
    }
  }
  return config;
}

/**
 * Convert query and headers to its JSON representation, since nedb does not allow keys (header names) to have dots.
 * The bodyJson property needs also to be marshalled because when converting from XML to JSON, come fields could
 * start with '$', which is not allowed by nedb
 *
 * @param lastRequest
 * @param copy True if marshalled object must be a copy of the original object
 * @private
 */
function _marshallLastRequest(lastRequest, copy) {
  var _lastRequest = copy ? extend(true, {}, lastRequest) : lastRequest;
  if (_lastRequest.query) {
    _lastRequest.query = JSON.stringify(_lastRequest.query);
  }
  if (_lastRequest.headers) {
    _lastRequest.headers = JSON.stringify(_lastRequest.headers);
  }
  if (_lastRequest.bodyJson) {
    _lastRequest.bodyJson = JSON.stringify(_lastRequest.bodyJson);
  }
  return _lastRequest;
}

/**
 * Convert query, headers and bodyJson from JSON to its javascript object representation
 *
 * @param lastRequests
 * @private
 */
function _unmarshallLastRequests(lastRequests) {
  lastRequests.forEach(function(lastRequest) {
    // Remove _id field
    delete lastRequest._id;
    // Convert query from JSON to javascript object
    if (lastRequest.query) {
      lastRequest.query = JSON.parse(lastRequest.query);
    }
    // Convert headers from JSON to javascript object
    if (lastRequest.headers) {
      lastRequest.headers = JSON.parse(lastRequest.headers);
    }
    // Convert jsonBody from JSON to javascript object
    if (lastRequest.bodyJson) {
      lastRequest.bodyJson = JSON.parse(lastRequest.bodyJson);
    }
  });
  return lastRequests;
}

module.exports = function middlewares(context) {
  return {
    defaultJsonContentType: function defaultJsonContentType(req, res, next) {
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      next();
    },

    ensureJson: function ensureJson(req, res, next) {
      // "Accept" header must include application/json
      if (req.accepts('application/json') === undefined) {
        res.statusCode = 406;
        return next(new Error('The client seems to not accept application/json body (see Accept header)'));
      }
      // "Content-Type" header must be application/json when using POST and PUT methods
      if ((req.method === 'POST' || req.method === 'PUT') && !req.is('application/json')) {
        res.statusCode = 400;
        return next(new Error('Content-Type header is not application/json'));
      }
      return next();
    },

    rawBodyParser: function rawBodyParser(req, res, next) {
      req.body = '';
      req.setEncoding('utf8');

      req.on('data', function(chunk) {
        req.body += chunk;
      });

      req.on('end', function() {
        next();
      });
    },

    errorHandler: function errorHandler(err, req, res, next) {
      res.json(err.status || res.statusCode, { error: err.message });
    },

    // Middlewares for Admin App
    admin: {
      configs: {
        create: function create(req, res, next) {
          var bodyErrs = jsonschema.validate(req.body, schemas.createConfig).errors;
          if (bodyErrs.length) {
            res.statusCode = 400;
            return next(new Error('Bad formed body [' + bodyErrs.map(function(err) { return err.stack; }).join(' | ') + ']'));
          }

          var config = req.body;
          config = _marshallConfig(config);
          _insertOverwriting(context.configs, config, function(err, newConfig) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            // Creating a config implies deleting any related last request
            context.lastRequests.remove({ method: config.method, path: config.path } , {}, function(err, numRemoved) {
              if (err) {
                res.statusCode = 500;
                return next(new Error('Database error [' + err + ']'));
              }
              newConfig = _unmarshallConfig(newConfig);
              res.location(_buildLocation(req, newConfig._id));
              res.json(201, newConfig);
            });
          });
        },

        readResource: function readResource(req, res, next) {
          if (Object.keys(req.query).length) {
            res.statusCode = 400;
            return next(new Error('Query parameters not allowed'));
          }
          context.configs.findOne({ _id: req.params.id }, function(err, config) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            if (config === null) {
              res.statusCode = 404;
              return next(new Error('Configuration with id \'' + req.params.id + '\' does not exist'));
            }
            config = _unmarshallConfig(config);
            res.json(200, config);
          });
        },

        readCollection: function readCollection(req, res, next) {
          context.configs.find(req.query, function(err, configList) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            configList = _unmarshallConfig(configList);
            res.json(200, configList);
          });
        },

        deleteResource: function deleteResource(req, res, next) {
          if (Object.keys(req.query).length) {
            res.statusCode = 400;
            return next(new Error('Query parameters not allowed'));
          }
          // Get method and path (needed to remove related last request)
          var filter = {};
          context.configs.findOne({ _id: req.params.id }, function(err, config) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            if (config === null) {
              res.statusCode = 404;
              return next(new Error('Configuration with id \'' + req.params.id + '\' does not exist'));
            }
            filter.method = config.method;
            filter.path = config.path;

            // Delete config
            context.configs.remove({ _id: req.params.id }, {}, function(err, numRemoved) {
              if (err) {
                res.statusCode = 500;
                return next(new Error('Database error [' + err + ']'));
              }
              // Deleting a config implies deleting any related last request
              context.lastRequests.remove(filter, {}, function(err, numRemoved) {
                if (err) {
                  res.statusCode = 500;
                  return next(new Error('Database error [' + err + ']'));
                }
                res.json(204, null);
              });
            });
          });
        },

        deleteCollection: function deleteCollection(req, res, next) {
          context.configs.remove(req.query, { multi: true }, function(err, numRemoved) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            // Deleting configs implies deleting any related last request
            context.lastRequests.remove(req.query, { multi: true }, function(err, numRemoved) {
              if (err) {
                res.statusCode = 500;
                return next(new Error('Database error [' + err + ']'));
              }
              res.json(204, null);
            });
          });
        }

      },

      timeout: {
        update: function update(req, res, next) {
          var bodyErrs = jsonschema.validate(req.body, schemas.updateTimeout).errors;
          if (bodyErrs.length) {
            res.statusCode = 400;
            return next(new Error('Bad formed body [' + bodyErrs.map(function(err) { return err.stack; }).join(' | ') + ']'));
          }

          context.timeout = req.body.timeout;
          res.json(200, req.body);
        },

        read: function read(req, res, next) {
          res.json(200, { timeout: context.timeout });
        }

      },

      lastRequests: {
        readCollection: function readCollection(req, res, next) {
          context.lastRequests.find(req.query, function(err, lastRequestList) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            lastRequestList = _unmarshallLastRequests(lastRequestList);
            res.json(200, lastRequestList);
          });
        },

        deleteCollection: function deleteCollection(req, res, next) {
          context.lastRequests.remove(req.query, { multi: true }, function(err, numRemoved) {
            if (err) {
              res.statusCode = 500;
              return next(new Error('Database error [' + err + ']'));
            }
            res.json(204, null);
          });
        }

      }
    },

    // Middleware for Mock (Note that mock is not using Express, so this is the handler for http.createServer)
    mock: {
      requestHandler: function requestHandler(req, res) {
        var path = url.parse(req.url).pathname;
        // Look up a configured response for the method and path used to call the mock
        context.configs.findOne({ method: req.method, path: path }, function(err, config) {
          if (err) {
            return _sendError(res, 'Database error [' + err + ']');
          }
          if (config === null) {
            return _sendError(res, 'No configuration found for method \'' + req.method + '\' and path \'' + path + '\'');
          }

          config = _unmarshallConfig(config);
          _buildRequestObject(req, config, function(err, requestObj) {
            if (err) {
              return _sendError(res, 'Error reading HTTP body: ' + err.message);
            }

            // Save the request in lastRequests
            context.lastRequests.insert(_marshallLastRequest(requestObj, true), function(err, newDoc) {
              if (err) {
                return _sendError(res, 'Database error [' + err + ']');
              }

              // Send the configured response, rendering Mustache templates
              setTimeout(function sendResponse() {
                for (var headerName in config.response.headers) {
                  if (config.response.headers.hasOwnProperty(headerName)) {
                    res.setHeader(headerName, mustache.render(config.response.headers[headerName], requestObj));
                  }
                }

                var bodyBuffer = null;
                if (!config.response.binaryBody) {
                  var body = mustache.render(config.response.body, requestObj);
                  //Take into account the charset defined in the configuration
                  bodyBuffer = iconv.encode(body, config.response.charset || 'utf-8');
                } else {
                  bodyBuffer = new Buffer(config.response.body, 'base64');
                }
                if (!config.response.chunked) {
                  res.setHeader('Content-Length', bodyBuffer.length);
                }
                res.writeHead(config.response.statusCode);
                res.end(bodyBuffer);
              }, config.response.delay || context.DEFAULT_DELAY);
            });
          });
        });
      }

    }
  }
};
