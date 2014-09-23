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

function _loadedFromProtractor() {
  var mod = module.parent;
  while (mod && mod.filename.indexOf('node_modules/protractor/') === -1) {
    mod = mod.parent;
  }
  return (mod !== null);
}

// When Tartare is loaded from Protractor, the Mocha to be patched is the one used by Protractor
var mocha = _loadedFromProtractor() ? require('../../../mocha') : require('mocha');
module.exports.mocha = mocha;
var jsep = require('jsep');


var TAGS_PREFIX = '<<##';
var TAGS_SUFFIX = '##>>';


// Add the method 'tag' to the Mocha Suite prototype so this method can be used as a chainable method
// after feature and scenario keywords
mocha.Suite.prototype.tag = function() {
  this.tags = this.tags || [];
  var argsArray = Array.prototype.slice.call(arguments);
  var tags = [];
  argsArray.forEach(function(arg) {
    if (arg) {
      tags = tags.concat(arg);
    }
  }, this);

  // Check that tags have valid syntax and allowed values
  tags.forEach(function(tag) {
    if (!/^[A-Za-z0-9_]+$/.test(tag)) {
      throw new Error('Invalid tag "' + tag + '". Tags can only have uppercase/lowercase letters, numbers and underscore.');
    }
    if ([ 'only', 'skip', 'manual', 'bug' ].indexOf(tag) !== -1) {
      throw new Error('Invalid tag "' + tag + '". These tags are reserved: only, skip, manual, bug.');
    }
  });

  this.tags = this.tags.concat(tags);

  return this;
};

/**
 * Add methods 'majorBug' and 'minorBug' to the Mocha Suite prototype so these methods can be used
 * as chainable methods after feature and scenario keywords
 */

function _setAttrDeepDown(suite, attr, value) {
  suite[attr] = value;
  if (suite.suites) {
    suite.suites.forEach(function(childSuite) {
      _setAttrDeepDown(childSuite, attr, value);
    });
  }
  if (suite.tests) {
    suite.tests.forEach(function(test) {
      test[attr] = value;
    });
  }
}

function _setAttrDeepUp(suite, attr, value) {
  while(!suite.root) {
    suite[attr] = value;
    suite = suite.parent;
  }
}

mocha.Suite.prototype.majorBug = function(bugId) {
  // If this method is called several times, the last value prevails
  _setAttrDeepDown(this, 'bugId', bugId);
  // This suite and all its children are considered as buggy
  _setAttrDeepDown(this, 'buggy', true);
  _setAttrDeepUp(this, 'buggy', true);
  this.tags.push('bug');
  return this;
};

mocha.Suite.prototype.minorBug = function(bugId) {
  // If this method is called several times, the last value prevails
  _setAttrDeepDown(this, 'bugId', bugId);
  // Setting a minor bug prevents the suite from being executed, in the same way that describe.skip does.
  // This is done by setting the 'pending' flag to true on this suite and all its children suites and tests.
  _setAttrDeepDown(this, 'pending', true);
  this.tags.push('bug');
  return this;
};

/**
 * Monkey patch Suite's fullTitle method so it includes the tags in the returned fullTitle.
 * This is needed because Mocha try to match the filter against the Suite's fullTitle.
 * Tags are surrounded with specific prefix and suffix to avoid collisions.
 */
mocha.Suite.prototype._fullTitle = mocha.Suite.prototype.fullTitle;
mocha.Suite.prototype.fullTitle = function() {
  var originalTitle = this.title;
  if (this.tags && this.tags.length) {
    this.title += TAGS_PREFIX + this.tags.join(TAGS_SUFFIX + TAGS_PREFIX) + TAGS_SUFFIX;
  }
  var fullTitle = this._fullTitle.call(this);
  this.title = originalTitle;
  return fullTitle;
};


/**
 * Inspect the filter tree recursively resolving the filter against the given tags
 * See http://jsep.from.so/ for more info
 */
function _calculateFilter(filterTree, tags) {
  switch(filterTree.type) {
    case 'Identifier':
      return (tags.indexOf(filterTree.name) !== -1);
      break;
    case 'UnaryExpression':
      switch(filterTree.operator) {
        case '+':
          return _calculateFilter(filterTree.argument, tags);
          break;
        case '-':
          return !_calculateFilter(filterTree.argument, tags);
          break;
      }
      break;
    case 'BinaryExpression':
      switch(filterTree.operator) {
        case '&':
          return _calculateFilter(filterTree.left, tags) && _calculateFilter(filterTree.right, tags);
          break;
        case '|':
          return _calculateFilter(filterTree.left, tags) || _calculateFilter(filterTree.right, tags);
          break;
      }
      break;
  }
  throw new Error('Invalid filter: Unsupported operation');
}

/**
 * We'll monkey patch the Mocha Runner's grep function with two purposes:
 *   1. Process the filter string (passed in as a RegExp to be compatible with Mocha's behaviour) and parse it,
 *      storing the parsed tree along with the original RegExp object.
 *   2. Redefine the 'test' method of each RegExp object (to avoid changing the RegExp prototype) to perform
 *      the matching against our own filter string, instead of using default reg exp matching.
 */
var runnerGrepFn = mocha.Runner.prototype.grep;
mocha.Runner.prototype.grep = function(re, invert) {
  var reStr = re.toString().slice(1, -1);
  if (!reStr.startsWith('tartare: ')) {
    // Tartare's filter starts with "tartare: ", so this is the default Mocha --grep behaviour
    return runnerGrepFn.call(this, re, invert);
  }

  // Unescape the filter string, that has been convoyed in the RegExp object
  // removing all \\ occurrences that are not preceded by \\ (to avoid removing escaped backslashes)
  var filterStr = reStr.split('tartare: ')[1].replace(/\\(?!\\)/g, '');
  try {
    // Parse the filter to create a syntax tree that will be attached to the original RegExp object as a cache
    re.filterTree = jsep(filterStr.replace(',', '&'));  // ',' will act as '&' operator
  } catch(err) {
    throw new Error('Invalid filter: ' + filterStr + ' [' + err.dedscription + ' at character ' + err.index + ']');
  }

  // Monkey patch the 'test' method for this RegExp object in order to perform the matching following our own filter syntax
  re.test = function(fullTitle) {
    // Extract tags from the full title using a reg exp that matches all strings
    // surrounded by the tag's prefix and suffix, using a lazy approach (instead of greedy)
    var tags = fullTitle.match(new RegExp(TAGS_PREFIX + '.*?' + TAGS_SUFFIX, 'g')) || [];
    tags = tags.map(function(tag) {
      return tag.slice(TAGS_PREFIX.length, -TAGS_SUFFIX.length);  // Remove the leading and trailing tag's prefix and suffix
    });

    return _calculateFilter(this.filterTree, tags);
  };
  // Call the original method, passing in the 'invert' parameter as 'false'
  // since we have our own syntax to perform NOT logic
  return runnerGrepFn.call(this, re, false);
};
