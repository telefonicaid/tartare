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

var os = require('os')
  , fs = require('fs')
  ;


/**
 * Add a get method to WebDriver promises. Allow to access object's properties and array's values
 * for promised objects or arrays. It takes an argument that specify a dotted path of property
 * names or indexes. Valid values would be: 0, '0', 'propertyName', '0.propertyName', etc.
 */
if (global.protractor) {
  Object.defineProperty(protractor.promise.Promise.prototype, 'get', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function (dottedPath) {
      return this.then(function(o) {
        var properties = dottedPath.toString().split('.');
        var value = o;
        properties.forEach(function(property) {
          value = value[property];
        });
        return protractor.promise.fulfilled(value);
      });
    }
  });
}


var NONASCII_STRING = 'ÁÉÍÓÚÄËÏÖÜÂÊÎÔÛÀÈÌÒÙÑÇáéíóúäëïöüâêîôûàèìòùñç';
var INJECTION_STRING = '<>{}()[]%&\'"=\\/?*.,;';


var promisize = function promisize(module) {
  if (!global.protractor) {
    throw new Error('promisize can only be used when running Protractor');
  }

  function _promisize(fn) {
    // Preventing function from being promisized twice.
    if (fn._promisized) {
      return fn;
    }

    var promisizedFn = function() {
      // If a callback is provided explicitly, call the original version
      if (arguments[arguments.length - 1] instanceof Function) {
        return fn.apply(this, arguments);
      }

      // Convert fn to a promise and enqueue it in the WebDriver Control Flow
      var args = arguments;
      return protractor.promise.controlFlow().execute(function() {
        var d = new protractor.promise.Deferred();
        var cb = function(err, res) {
          if (err) {
            return d.reject(err);
          }
          d.fulfill(res);
        };
        Array.prototype.push.call(args, cb);
        fn.apply(this, args);
        return d.promise;
      });
    };

    // Marking function as promisized
    promisizedFn._promisized = true;
    return promisizedFn;
  }

  for (var name in module) {
    if (module.hasOwnProperty(name)) {
      if (typeof module[name] === 'object') {
        promisize(module[name]);
      } else if ((module[name] instanceof Function) && !module[name].dontPromisize) {
        module[name] = _promisize(module[name]);
      }
    }
  }
};

/**
 * Guess the OS you are running, taking into account different Linux distributions
 * @returns {*}
 */
var getOS = function getOS() {
  var osName = null;
  switch (os.platform()) {
    case 'linux':
      // There is no a standard way of detecting Linux distributions inside Node.js
      try {
        // Try Redhat
        fs.readFileSync('/etc/redhat-release', { encoding: 'utf-8' });
        osName = 'redhat';
      } catch(e) {
        try {
          // Try Ubuntu
          var release = fs.readFileSync('/etc/lsb-release', { encoding: 'utf-8' });
          if (release.split(os.EOL)[0].match(/ubuntu/i)) {
            osName = 'ubuntu';
          }
        } catch (e) {

        }
      }
      break;
    case 'darwin':
      osName = 'osx';
      break;
  }

  return osName;
};

module.exports = {
  NONASCII_STRING: NONASCII_STRING,
  INJECTION_STRING: INJECTION_STRING,

  promisize: promisize,
  getOS: getOS
};
