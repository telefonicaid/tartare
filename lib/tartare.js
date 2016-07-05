/*

 Copyright 2015-2016 Telefonica Investigación y Desarrollo, S.A.U

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

var Mocha = require('mocha');
var GherkinBase = require('./reporters/gherkin-base');
var path = require('path');

// Apply patches
require('./patches')(Mocha);

module.exports = Tartare;

function _convertToLowerCamelCase(token, index) {
  if (index > 0) {
    return token.slice(0, 1).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token.toLowerCase();
}

/**
 * Setup Tartare with `options`.
 *
 * Options:
 *   - `reporter` reporter name, defaults to `tartare.reporters.gherkin`
 *   - `reporterOptions` reporter-specific options (It can be an object or a string with a list of key=value pairs
 *     separated by commas)
 *   - `timeout` timeout in milliseconds
 *   - `bail` bail on the first step failure
 *   - `filter` expression to filter tests with
 *   - `useColors` set whether colors can be used on console reporters
 *   - `theme`: set the color theme to be used with the gherkin reporter (dark or clear)
 *   - `interactive` set whether the interactive features are enabled or not
 *   - `enableTimeouts` enable timeouts
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
  this.options.theme = this.options.theme || 'dark';
  this.options.interactive = this.options.interactive !== false;
  this.options.enableTimeouts = this.options.enableTimeouts !== false;

  // Read Tartare env vars (some of them could overwrite the former options)
  Object.keys(process.env).forEach(function(envName) {
    if (envName.startsWith('TARTARE_')) {
      var optName = envName.slice('TARTARE_'.length).split('_').map(_convertToLowerCamelCase).join('');
      this.options[optName] = process.env[envName];
    }
  }, this);

  // Sanitize opts
  this.options.timeout = Number(this.options.timeout);
  if (isNaN(this.options.timeout)) {
    throw new Error('Invalid timeout. It must be a number.');
  }
  if (this.options.filter && !/^[A-Za-z0-9_ ,+&|()-]+$/.test(this.options.filter)) {
    throw new Error('Invalid filter "' + this.options.filter + '". See tartare -h for more info.');
  }
  if (!/^(dark|clear)$/.test(this.options.theme)) {
    throw new Error('Invalid theme "' + this.options.theme + '". Only "dark" and "clear" are allowed.');
  }
  ['bail', 'useColors', 'interactive', 'enableTimeouts'].forEach(function(optName) {
    // eslint-disable-next-line eqeqeq
    this.options[optName] = this.options[optName] != 0;  // Force boolean from values 0 or 1
  }, this);
  if (this.options.reporterOptions && typeof this.options.reporterOptions === 'string') {
    // Convert a comma-separated list of key=value pairs to an object
    var reporterOptions = this.options.reporterOptions;
    this.options.reporterOptions = {};
    reporterOptions.split(',').forEach(function(repOpt) {
      var repOptNV = repOpt.split('=');
      var repOptName = repOptNV[0];
      if (!repOptName.length) {
        throw new Error('Invalid reporter option "' + repOpt + '". Missing option name');
      }
      if (repOptNV.length === 1) {  // repOptName w/o optValue
        this.options.reporterOptions[repOptName] = true;
      } else {
        var optValue = repOptNV.slice(1).join('=');
        if (!optValue.length) {
          throw new Error('Invalid reporter option "' + repOpt + '". Missing option value');
        }
        this.options.reporterOptions[repOptName] = optValue;
      }
    }, this);
  }

  var mochaOpts = {
    ui: path.join(__dirname, './interfaces/gherkin'),
    reporter: require('./reporters/' + this.options.reporter),
    reporterOptions: this.options.reporterOptions,
    timeout: this.options.timeout,
    bail: this.options.bail,
    useColors: this.options.useColors,
    enableTimeouts: this.options.enableTimeouts
  };
  this.mocha = new Mocha(mochaOpts);
  this.mocha.tartare = this;

  if (this.options.filter) {
    this.mocha.options.grep = this.options.filter;
  }

  this.mocha.suite.on('pre-require', function(context) {
    module.exports.feature = context.feature;
    module.exports.scenario = context.scenario;
    module.exports.given = context.given;
    module.exports.when = context.when;
    module.exports.then = context.then;
    module.exports.and = context.and;
    module.exports.but = context.but;
    module.exports.beforeAll = context.beforeFeature;
    module.exports.beforeFeature = context.beforeAll;
    module.exports.beforeEachScenario = context.beforeEachScenario;
    module.exports.beforeScenario = context.beforeScenario;
    module.exports.beforeEachVariant = context.beforeEachVariant;
    module.exports.afterEachVariant = context.afterEachVariant;
    module.exports.afterScenario = context.afterScenario;
    module.exports.afterEachScenario = context.afterEachScenario;
    module.exports.afterFeature = context.afterFeature;
    module.exports.afterAll = context.afterAll;
    module.exports.getTartareOptions = context.getTartareOptions;
    module.exports.synchronize = context.synchronize;
    module.exports.promisize = context.promisize;
    module.exports.sleep = context.sleep;
  });
}

/**
 * Add test `file`.
 * @param {string|string[]} files
 * @return {Tartare}
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
 */
Tartare.prototype.run = function(fn) {
  GherkinBase.theme = this.options.theme;
  GherkinBase.interactive = this.options.interactive;
  return this.mocha.run(fn);
};
