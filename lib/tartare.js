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

module.exports = Tartare;
var utils = require('./utils');
for (var _export in utils) {
  module.exports[_export] = utils[_export];
}
module.exports.collections = require('./collections');
module.exports.apiMockAdminClient = require('./apimock-admin-client');
module.exports.server = require('./server');
module.exports.http = require('./http');
require('./chai-plugins');


var Mocha = require('mocha');

/**
 * Setup Tartare with `options`.
 *
 * Options:
 *   - `reporter` reporter name, defaults to `tartare.reporters.gherkin`
 *   - `timeout` timeout in milliseconds
 *   - `bail` bail on the first step failure
 *   - `filter` expression to filter tests with
 *   - Any other options will be available through the `getTartareOptions` function
 *
 * @param {Object} options
 */

function Tartare(options) {
  this.options = options || {};
  this.options.reporter = this.options.reporter || 'gherkin';
  this.options.timeout = this.options.timeout || 10000;
  this.options.bail = this.options.bail !== false;
  this.options.useColors = this.options.useColors !== false;
  this.options.enableTimeouts = this.options.enableTimeouts !== false;

  var mochaOpts = {
    ui: 'bdd',
    reporter: require('./mocha-gherkin/reporters/' + this.options.reporter),
    timeout: this.options.timeout,
    bail: this.options.bail,
    useColors: this.options.useColors,
    enableTimeouts: this.options.enableTimeouts
  };
  this.mocha = new Mocha(mochaOpts);

  require('./mocha-gherkin/mocha-gherkin');  // TODO: make it a new interface
  // TODO: The former load patches
  if (this.options.filter) {
    this.mocha.options.grep = this.options.filter;
  }



  this.mocha.suite.on('pre-require', function (context) {
    console.log('PRE-REQUIRE!!!');
  });
}

/**
 * Add test `file`.
 *
 * @param {String|Array} files
 * @api public
 */

Tartare.prototype.addFiles = function(files) {
  if (!Array.isArray(files)) {
    files = [files];
  }
  files.forEach(function(file) {
    this.mocha.addFile(file);
  }, this);
  return this;
};


/**
 * Run tests and invoke `fn()` when complete.
 *
 * @param {Function} fn
 * @return {Runner}
 * @api public
 */

Tartare.prototype.run = function(fn) {
  return this.mocha.run(fn);
};
