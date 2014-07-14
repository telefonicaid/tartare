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

var _ = require('underscore')
  , sync = require('synchronize');

var utils = require('../utils')
  , LABELS = require('./common').LABELS;


var createFeature = function createFeature(options) {
  return function() {
    var feature = arguments[0];
    var story = arguments.length >= 3 ? _.toArray(arguments).slice(1, arguments.length - 1) : [];
    var fn = arguments[arguments.length - 1];

    var title = LABELS.feature + ': ' + feature;
    story.forEach(function(line) {
      title += '\n' + line;
    });

    var _describe = options.skip ? describe.skip : options.only ? describe.only : describe;
    _describe(title, fn);
  };
};

module.exports.feature = createFeature({});
module.exports.feature.only = createFeature({ only: true });
module.exports.feature.skip = createFeature({ skip: true });


var createScenario = function createScenario(options) {
  return function(title, dataset, fn) {
    var _describe = options.skip ? describe.skip : options.only ? describe.only : describe;

    switch(arguments.length) {
      case 1:
        title = LABELS.scenario + ': ' + title;
        describe.skip(title, function() {
          it('Pending');
        });
        break;

      case 2:
        fn = dataset;
        _describe(LABELS.scenario + ': ' + title, function() {
          describe(LABELS.variant + ': ' + title, fn);
        });
        break;

      case 3:
        title = LABELS.scenario + ': ' + title;
        _describe(title, function() {
          dataset.forEach(function(variant, index) {
            title = LABELS.variant + ' #' + (index + 1);
            var desc = utils.formatTestDescription(variant.desc, variant.tag, variant.bugId);
            if (desc) {
              title += ': ' + desc;
            }
            var _describe = variant.skip ? describe.skip : variant.only ? describe.only : describe;
            _describe(title, function() {
              fn.call(this, variant);
            });
          });
        });
        break;
    }
  };
};

module.exports.scenario = createScenario({});
module.exports.scenario.only = createScenario({ only: true });
module.exports.scenario.skip = createScenario({ skip: true });


var createStep = function createStep(options) {
  return function(title, fn) {
    title = LABELS[options.type] + ': ' + title;

    if (!options.async) {
      fn = sync.asyncIt(fn);
    }
    it(title, fn);
  };
};

module.exports.given = createStep({ type: 'given' });
module.exports.given.async = createStep({ type: 'given', async: true });
module.exports.when = createStep({ type: 'when' });
module.exports.when.async = createStep({ type: 'when', async: true });
module.exports.then = createStep({ type: 'then' });
module.exports.then.async = createStep({ type: 'then', async: true });
module.exports.and = createStep({ type: 'and' });
module.exports.and.async = createStep({ type: 'and', async: true });


var createHook = function createHook(options) {
  return function(fn) {
    if (!options.async) {
      fn = sync.asyncIt(fn);
    }
    // Call Mocha hook
    global[options.type](fn);
  };
};

module.exports.beforeFeature = createHook({ type: 'before' });
module.exports.beforeFeature.async = createHook({ type: 'before', async: true });
module.exports.afterFeature = createHook({ type: 'after' });
module.exports.afterFeature.async = createHook({ type: 'after', async: true });
module.exports.beforeEachVariant = createHook({ type: 'before' });
module.exports.beforeEachVariant.async = createHook({ type: 'before', async: true });
module.exports.afterEachVariant = createHook({ type: 'after' });
module.exports.afterEachVariant.async = createHook({ type: 'after', async: true });


for (var name in module.exports) {
  if (module.exports.hasOwnProperty(name)) {
    global[name] = module.exports[name];
  }
}
