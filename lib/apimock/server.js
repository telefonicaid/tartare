'use strict';

module.exports = function apiMockServer(settings) {
  var http = require('http')
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

  if (settings.httpsPort) {
    var https = require('https')
      , fs = require('fs')
      ;

    // Read private key and certificate to set up an SSL server
    var privateKey = fs.readFileSync(settings.httpsKeyPath, 'utf8')
      , certificate = fs.readFileSync(settings.httpsCertPath, 'utf8');

    https.createServer({ key: privateKey, cert: certificate }, middlewares.mock.requestHandler)
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

};
