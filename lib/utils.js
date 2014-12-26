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

var sync = require('synchronize')
  , os = require('os')
  , fs = require('fs')
  ;

/**
 *  Add startsWith method to String objects
 */
if (!String.prototype.startsWith) {
  Object.defineProperty(String.prototype, 'startsWith', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function (searchString, position) {
      position = position || 0;
      return this.indexOf(searchString, position) === position;
    }
  });
}

/**
 *  Add endsWith method to String objects
 */
if (!String.prototype.endsWith) {
  Object.defineProperty(String.prototype, 'endsWith', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function (searchString, position) {
      position = position || this.length;
      position = position - searchString.length;
      var lastIndex = this.lastIndexOf(searchString);
      return lastIndex !== -1 && lastIndex === position;
    }
  });
}

/**
 *  Add repeat method to String objects
 */
if (!String.prototype.repeat) {
  Object.defineProperty(String.prototype, 'repeat', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function (count) {
      var result = '', pattern = this.valueOf();
      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }
        count >>= 1;
        pattern += pattern;
      }
      return result;
    }
  });
}

/**
 *  Add escape method to RegExp objects
 */
RegExp.escape = function(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

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

var synchronize = function synchronize(module) {
  for (var name in module) {
    if (module.hasOwnProperty(name)) {
      if (typeof module[name] === 'object') {
        synchronize(module[name]);
      } else if ((module[name] instanceof Function) && !module[name].dontSync) {
        sync(module, name);
      }
    }
  }
};

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

/**
 * Get options passed to Tartare as an env var or a command line argument.
 * Command line arguments supersede env vars.
 * An Tartare's env var takes the uppercase name of its equivalent command line argument, prefixed by TARTARE_,
 * and where hyphens are replaced by underscores. Ej: --my-cool-opt ==> TARTARE_MY_COOL_OPT
 *
 * @param optName Option name whose value is wanted. Without this parameter, this function returns an object
 *                with all the options recognized by Tartare
 * @returns {*}
 */
var getTartareOptions = function getTartareOptions(optName) {
  var tartareOpts = [ 'environment', 'theme', 'bugid-link' ];
  var tartareOptsEnv = tartareOpts.map(function(opt) {
    return 'TARTARE_' + opt.toUpperCase().replace('-', '_');
  });
  var opts = {};

  // Firstly look up in env vars
  tartareOptsEnv.forEach(function(optName, index) {
    if (process.env[optName]) {
      opts[tartareOpts[index]] = process.env[optName];
    }
  });

  // Then look up in command line arguments
  for (var i = 2; i < process.argv.length; i++) {
    // First and second arguments are 'node' and the name of the executable node file
    var _optName = process.argv[i].slice(2);  // Remove leading hyphens
    if (tartareOpts.indexOf(_optName) !== -1) {
      // It's a recognized parameter. Try to get the value
      if (process.argv[i + 1]) {
        opts[_optName] = process.argv[i + 1];
        i++;
      }
    }
  }

  if (optName) {
    return opts[optName];
  } else {
    return opts;
  }
};

module.exports = {
  NONASCII_STRING: NONASCII_STRING,
  INJECTION_STRING: INJECTION_STRING,

  // Backwards compatibility
  getHttpReason: function getHttpReason() {
    return require('./http').getReason.apply(this, arguments);
  },
  getHttpBasicAuthDataset: function getHttpBasicAuthDataset() {
    return require('./http').getBasicAuthDataset.apply(this, arguments);
  },
  lowerCaseHeaders: function lowerCaseHeaders() {
    return require('./http').lowerCaseHeaders.apply(this, arguments);
  },

  synchronize: synchronize,
  promisize: promisize,
  getOS: getOS,
  getCommandLineArguments: getTartareOptions,
  getTartareOptions: getTartareOptions
};
