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


var NONASCII_STRING = 'ÁÉÍÓÚÄËÏÖÜÂÊÎÔÛÀÈÌÒÙÑÇáéíóúäëïöüâêîôûàèìòùñç';
var INJECTION_STRING = '<>{}()[]%&\'"=\\/?*.,;';

var formatTestDescription = function formatTestDescription(description, tags, bugId) {
  var desc = [];
  if (tags && !(tags instanceof Array)) {
    tags = [tags];
  }
  if (tags) {
    tags.forEach(function(tag) {
      desc.push('@' + tag);
    });
  }
  if (description) {
    desc.push(description);
  }
  if (bugId) {
    desc.push('BUG ' + bugId);
  }
  return desc.join(' ');
};

var synchronize = function synchronize(module) {
  for (var name in module) {
    if (module.hasOwnProperty(name)) {
      if ((module[name] instanceof Function) && !module[name].dontSync) {
        sync(module, name);
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
 * Get command line arguments passed to mocha and recognized by Tartare
 *
 * @param argName Argument name whose value is wanted. Without this parameter, this function returns an object
 *                with all the parameters recognized by Tartare
 * @returns {*}
 */
var getCommandLineArguments = function getCommandLineArguments(argName) {
  var tartareParams = ['environment'];
  var args = {};

  // First and second arguments are 'node' and the name of the executable node file
  for (var i = 2; i < process.argv.length; i++) {
    var _argName = process.argv[i].slice(2);  // Remove leading hyphens
    if (tartareParams.indexOf(_argName) !== -1) {
      // It's a recognized parameter. Try to get the value
      if (process.argv[i + 1]) {
        args[_argName] = process.argv[i + 1];
        i++;
      }
    }
  }

  if (argName) {
    return args[argName];
  } else {
    return args;
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

  formatTestDescription: formatTestDescription,
  synchronize: synchronize,
  getOS: getOS,
  getCommandLineArguments: getCommandLineArguments
};
