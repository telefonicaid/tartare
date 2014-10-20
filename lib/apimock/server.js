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

module.exports = function apiMockServer(settings) {
  var http = require('http')
    , https = require('https')
    , fs = require('fs')
    , express = require('express')
    , Datastore = require('nedb')
    , middlewares = require('./middlewares')
    , utils = require('../utils')
    ;

  var DEFAULT_TIMEOUT = 2 * 60 * 1000;  // Default timeout to maintain open a connection (keep-alive)

  var context = {
    timeout: settings.timeout || DEFAULT_TIMEOUT,
    configs: new Datastore(),
    lastRequests: new Datastore(),
    DEFAULT_DELAY: 100
  };
  context.configs.ensureIndex({ fieldName: 'method' });
  context.configs.ensureIndex({ fieldName: 'path' });
  context.lastRequests.ensureIndex({ fieldName: 'method' });
  context.lastRequests.ensureIndex({ fieldName: 'path' });

  middlewares = middlewares(context);


  /****************
   *  ADMIN APP   *
   ****************/
  var adminApp = express();
  var basePath = '/admin/v1';
  var configsBasePath = basePath + '/configs';
  var timeoutBasePath = basePath + '/timeout';
  var lastRequestsBasePath = basePath + '/lastrequests';

  adminApp.set('port', settings.adminPort);
  // Assume json content when not Content-Type header available
  adminApp.use(middlewares.defaultJsonContentType);
  // Only accept and return JSON documents
  adminApp.use(middlewares.ensureJson);
  adminApp.use(express.bodyParser({ limit: '50mb' }));
  adminApp.use(adminApp.router);
  adminApp.use(middlewares.errorHandler);

  // Create a new config
  adminApp.post(configsBasePath, middlewares.admin.configs.create);
  // Read configs
  adminApp.get(configsBasePath + '/:id', middlewares.admin.configs.readResource);
  adminApp.get(configsBasePath, middlewares.admin.configs.readCollection);
  // Delete configs
  adminApp.del(configsBasePath + '/:id', middlewares.admin.configs.deleteResource);
  adminApp.del(configsBasePath, middlewares.admin.configs.deleteCollection);

  // Modify server timeout for new connections
  adminApp.put(timeoutBasePath, middlewares.admin.timeout.update);
  // Read server timeout
  adminApp.get(timeoutBasePath, middlewares.admin.timeout.read);

  // Read last requests
  adminApp.get(lastRequestsBasePath, middlewares.admin.lastRequests.readCollection);
  // Delete last requests
  adminApp.del(lastRequestsBasePath, middlewares.admin.lastRequests.deleteCollection);


  /***********************
   *  Start the servers  *
   ***********************/

  http.createServer(adminApp)
    .on('error', function onError(err) {
      console.log('API Mock Administration Server ERROR:');
      console.error(err.stack);
      process.exit(-101);
    })
    .on('listening', function onListening() {
      console.log('API Mock Administration server listening on port', settings.adminPort);
    })
    .listen(settings.adminPort);

  if (settings.httpPort) {
    http.createServer(middlewares.mock.requestHandler)
      .on('error', function onError(err) {
        console.log('API Mock Server (HTTP) ERROR:');
        console.error(err.stack);
        process.exit(-102);
      })
      .on('listening', function onListening() {
        console.log('API Mock Server (HTTP) listening on port', settings.httpPort);
      })
      .on('connection', function onConnection(socket) {
        socket.setTimeout(context.timeout);
      })
      .listen(settings.httpPort);
  }

  if (settings.httpsPort) {
    // Read private key and certificate to set up an SSL server
    var optsHttps = {
      key: fs.readFileSync(settings.httpsKeyPath, 'utf8'),
      cert: fs.readFileSync(settings.httpsCertPath, 'utf8')
    };

    https.createServer(optsHttps, middlewares.mock.requestHandler)
      .on('error', function onError(err) {
        console.log('API Mock Server (HTTPS) ERROR:');
        console.error(err.stack);
        process.exit(-103);
      })
      .on('listening', function onListening() {
        console.log('API Mock Server (HTTPS) listening on port', settings.httpsPort);
      })
      .on('connection', function onConnection(socket) {
        socket.setTimeout(context.timeout);
      })
      .listen(settings.httpsPort);
  }

  if (settings.twowaysslPort) {
    // Read private key, certificate and authority certificate to set up a 2waySSL server
    var optsTwowayssl = {
      key: fs.readFileSync(settings.twowaysslKeyPath, 'utf8'),
      cert: fs.readFileSync(settings.twowaysslCertPath, 'utf8'),
      ca: fs.readFileSync(settings.twowaysslCAPath, 'utf8'),
      requestCert: true,
      rejectUnauthorized: true
    };

    https.createServer(optsTwowayssl, middlewares.mock.requestHandler)
      .on('error', function onError(err) {
        console.log('API Mock Server (2waySSL) ERROR:');
        console.error(err.stack);
        process.exit(-103);
      })
      .on('listening', function onListening() {
        console.log('API Mock Server (2waySSL) listening on port', settings.twowaysslPort);
      })
      .on('connection', function onConnection(socket) {
        socket.setTimeout(context.timeout);
      })
      .listen(settings.twowaysslPort);
  }

};
