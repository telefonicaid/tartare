/*

 Copyright 2015-2017 Telefonica Investigación y Desarrollo, S.A.U

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

var jsep = require('jsep');
var util = require('util');

var RESERVED_TAGS = ['only', 'skip', 'manual', 'bug'];

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
  while (!suite.root) {
    suite[attr] = value;
    suite = suite.parent;
  }
}

/**
 * Inspect the filter tree recursively resolving the filter against the given tags.
 * See http://jsep.from.so/ for more info.
 *
 * @param {?Object} filterTree - The filter tree as returned by the jsep module.
 * @param {string[]} tags - Tags to be matched.
 * @return {boolean} - Indicate whether the filter resolves against the given tags.
 */
function _calculateFilter(filterTree, tags) {
  /* eslint-disable default-case */
  switch (filterTree.type) {
    case 'Identifier':
      return filterTree.name in tags;
    case 'UnaryExpression':
      switch (filterTree.operator) {
        case '+':
          return _calculateFilter(filterTree.argument, tags);
        case '-':
          return !_calculateFilter(filterTree.argument, tags);
      }
      break;
    case 'BinaryExpression':
      switch (filterTree.operator) {
        case '&':
          return _calculateFilter(filterTree.left, tags) && _calculateFilter(filterTree.right, tags);
        case '|':
          return _calculateFilter(filterTree.left, tags) || _calculateFilter(filterTree.right, tags);
      }
      break;
  }
  /* eslint-enable default-case */
  throw new Error('Invalid filter: Unsupported operation');
}

/**
 * Wrap a String object adding a `tags` property. It can create a new "enhanced" String objects or merge an
 * existent one with the given `str` and `tags` parameters.
 *
 * @param {?string} fullTitle - First string.
 * @param {string} str - Second string, to be concatenated with the first one, if any.
 * @param {Object} tags - Tags object to be added to the String object.
 * @return {string} - The new "enhanced" string.
 */
function _fullTitle(fullTitle, str, tags) {
  function _mergeTags(currentTags, newTags) {
    newTags = newTags || {};
    Object.keys(newTags).forEach(function(tag) {
      currentTags[tag] = true;
    });
  }

  // eslint-disable-next-line no-new-wrappers
  var s = new String(fullTitle && fullTitle.length ? fullTitle + ' ' + str : str);
  s.inspect = function inspect() {
    return s.toString();
  };
  s.tags = {};
  if (fullTitle) {
    _mergeTags(s.tags, fullTitle.tags);
  }
  _mergeTags(s.tags, tags);
  return s;
}

module.exports = function(Mocha) {
  /* eslint-disable no-extend-native */

  /**
   *  Add startsWith method to String objects.
   */
  if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: function(searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
      }
    });
  }

  /**
   *  Add endsWith method to String objects.
   */
  if (!String.prototype.endsWith) {
    Object.defineProperty(String.prototype, 'endsWith', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: function(searchString, position) {
        position = position || this.length;
        position -= searchString.length;
        var lastIndex = this.lastIndexOf(searchString);
        return lastIndex !== -1 && lastIndex === position;
      }
    });
  }

  /**
   *  Add repeat method to String objects.
   */
  if (!String.prototype.repeat) {
    Object.defineProperty(String.prototype, 'repeat', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: function(count) {
        var result = '';
        var pattern = this.valueOf();
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
  /* eslint-enable no-extend-native */

  /**
   *  Add escape method to RegExp objects.
   *  @param {string} s
   *  @return {string}
   */
  RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  /**
   * Add a get method to WebDriver promises. Allow to access object's properties and array's values
   * for promised objects or arrays. It takes an argument that specify a dotted path of property
   * names or indexes. Valid values would be: 0, '0', 'propertyName', '0.propertyName', etc.
   *
   * @return {protractor.promise.Promise}
   */
  if (global.protractor) {
    Object.defineProperty(global.protractor.promise.Promise.prototype, 'get', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: function(dottedPath) {
        return this.then(function(o) {
          var properties = dottedPath.toString().split('.');
          var value = o;
          properties.forEach(function(property) {
            value = value[property];
          });
          return global.protractor.promise.fulfilled(value);
        });
      }
    });
  }

  /**
   * Add the method 'tag' to the Mocha Suite prototype so this method can be used
   * as a chainable method after feature and scenario keywords.
   *
   * @return {Suite}
   */
  Mocha.Suite.prototype.tag = function() {
    this.tags = this.tags || {};
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
        throw new Error('Invalid tag "' + tag +
            '". Tags can only have uppercase/lowercase letters, numbers and underscore.');
      }
      if (RESERVED_TAGS.indexOf(tag) !== -1) {
        throw new Error('Invalid tag "' + tag + '". These tags are reserved: ' + RESERVED_TAGS.join(', ') + '.');
      }
      this.tags[tag] = true;
    }, this);

    return this;
  };

  /**
   * Add methods 'majorBug' and 'minorBug' to the Mocha Suite prototype so these methods can be used
   * as chainable methods after feature and scenario keywords.
   *
   * @param {string} bugId
   * @return {Suite}
   */
  Mocha.Suite.prototype.majorBug = function(bugId) {
    // If this method is called several times, the last value prevails
    _setAttrDeepDown(this, 'bugId', bugId);
    // This suite and all its children are considered as buggy
    _setAttrDeepDown(this, 'buggy', true);
    _setAttrDeepUp(this, 'buggy', true);
    this.tags.bug = true;
    return this;
  };
  Mocha.Suite.prototype.minorBug = function(bugId) {
    // If this method is called several times, the last value prevails
    _setAttrDeepDown(this, 'bugId', bugId);
    // Setting a minor bug prevents the suite from being executed, in the same way that describe.skip does.
    // This is done by setting the 'pending' flag to true on this suite and all its children suites and tests.
    _setAttrDeepDown(this, 'pending', true);
    this.tags.bug = true;
    return this;
  };

  /**
   * Mocha Runner has a `grep` function which stores a RegExp in the `_grep` property. Such a RegExp has a
   * `test` method that will be used later against the suite/test full title to know whether the suite/test
   * pass the filter or not.
   * We'll monkey patch this function, so now it accepts a Tartare filter string and store an object
   * in the `_grep` property with:
   *   - The parsed tree corresponding to the filter string.
   *   - A `test` method that behaves as the RegExp's method but matching the filter tree against a
   *     modified String object that `fullTitle` functions return, conveying a `tag` property with
   *     the tags from the test/suite and all its parents.
   *
   *  @param {string} filter - The filter string passed to the Tartare constructor.
   *  @return {Runner}
   */
  Mocha.Runner.prototype.grep = function(filter) {
    var filterTree;
    try {
      filterTree = util.isRegExp(filter) ? null : jsep(filter.replace(',', '&'));  // ',' will act as '&' operator
    } catch (err) {
      throw new Error('Invalid filter: ' + filter + ' [' + err.description + ' at character ' + err.index + ']');
    }

    this._grep = {
      filterTree: filterTree,
      test: function test(fullTitle) {
        var tags = fullTitle.tags;
        if (!this.filterTree) {
          return true;
        }
        return _calculateFilter(this.filterTree, tags);
      }
    };
    this._invert = false;  // We have our own syntax to perform NOT Logic
    this.total = this.grepTotal(this.suite);
    return this;
  };

  /**
   * Monkey patch the Suite's and Runnable's fullTitle method so it returns a String object that conveys the full title,
   * but also a `tag` property with all the tags from the Suite/Runnable and its parents.
   * This is used by the filter's `test` method defined above.
   *
   * @return {string}
   */
  Mocha.Suite.prototype.fullTitle = function fullTitle() {
    if (this.parent) {
      return _fullTitle(this.parent.fullTitle(), this.title, this.tags);
    }
    return _fullTitle(null, this.title, this.tags);
  };
  Mocha.Runnable.prototype.fullTitle = function fullTitle() {
    return _fullTitle(this.parent.fullTitle(), this.title);
  };
};
