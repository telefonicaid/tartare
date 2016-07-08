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

var Suite = require('mocha/lib/suite');
var Test = require('mocha/lib/test');
var sync = require('synchronize');

/**
 * Gherkin-style interface:
 *
 *      feature('Feature title', function() {
 *        scenario('Scenario title', function() {
 *          given('that some precondition is fulfilled', function() {
 *
 *          });
 *          when('something happens', function() {
 *
 *          });
 *          then('assertions are fulfilled', function() {
 *
 *          });
 *        });
 *      });
 *
 */

var LABELS = {
  feature: 'Feature',
  scenario: 'Scenario',
  variant: 'Variant',
  given: 'Given',
  when: 'When',
  then: 'Then',
  and: 'And',
  but: 'But'
};

module.exports = function(rootSuite) {
  var suites = [rootSuite];

  rootSuite.on('pre-require', function(context, file, mocha) {
    function _createFeature(options) {
      return function() {
        // A Feature must be at top level
        if (!suites[0].root) {
          throw new Error('A feature must be at top level');
        }

        // Skipped features are ignored
        if (options.skip) {
          return new Suite();  // Return a suite object so chained methods can be called
        }

        var title = LABELS.feature + ': ' + arguments[0];
        var subtitle = [];
        var fn = null;
        for (var i = 1; i < arguments.length; i++) {
          if (arguments[i] instanceof Function) {
            fn = arguments[i];
            break;
          }
          subtitle.push(arguments[i]);
        }

        var suite = Suite.create(suites[0], title);
        suite.type = 'feature';
        suite.subtitle = subtitle;
        suite.tags = {};
        suite.manual = options.manual || !fn;
        if (suite.manual) {
          suite.pending = true;
          suite.tags.manual = true;
        } else {
          suite.file = file;
        }
        suite._beforeEachScenarioFns = [];
        suite._afterEachScenarioFns = [];

        suites.unshift(suite);
        if (fn) {
          fn.call(suite);
        } else {
          // We need to add a dummy test or Mocha will not emit any suite related event
          // and the suite title would not be printed. Anyway, this test will be
          // ignored by the gherkin-like reporters
          var test = new Test('Feature w/o implementation');
          test.file = file;
          suite.addTest(test);
        }
        suites.shift();

        if (options.only) {
          suite.tags.only = true;
          mocha.options.grep = 'only';
        }

        return suite;
      };
    }

    /**
     * Define a "feature" with the given `title`, `subtitle`,
     * and callback `fn` containing nested "scenarios".
     */

    context.feature = _createFeature({});
    context.feature.only = _createFeature({only: true});
    context.feature.skip = _createFeature({skip: true});
    context.feature.manual = _createFeature({manual: true});
    context.feature.manual.skip = _createFeature({manual: true, skip: true});

    function _createScenario(options) {
      return function(title, dataset, fn) {
        // A Scenario must be inside a Feature
        if (suites[0].type !== 'feature') {
          throw new Error('A scenario must be inside a Feature');
        }

        // Skipped scenarios are ignored
        if (options.skip) {
          return new Suite();  // Return a suite object so chained methods can be called
        }

        if (dataset instanceof Function && !fn) {
          fn = dataset;
          dataset = null;
        }

        var suite = Suite.create(suites[0], LABELS.scenario + ': ' + title);
        suite.type = 'scenario';
        suite.tags = {};
        suite.manual = options.manual || !fn || suite.parent.manual;
        if (suite.manual) {
          suite.pending = true;
          suite.tags.manual = true;
          suite.parent.hasManualChildren = true;
          suite.parent.tags.manual = true;
        } else {
          suite.file = file;
        }

        // Add beforeEachScenario/afterEachScenario hooks as beforeScenario/afterScenario for each scenario.
        // This will add those hooks when they are defined before the scenario definition. For those hooks defined
        // after the scenario definition, the createEachScenarioHook function will add them directly to the scenarios
        if (!suite.pending) {
          suite.parent._beforeEachScenarioFns.forEach(function(beforeEachScenarioFn) {
            suite.beforeAll('beforeEachScenario', _skipPending(beforeEachScenarioFn, suite));
            var hooksArray = suite._beforeAll;
            hooksArray[hooksArray.length - 1].subtype = 'beforeEachScenario';
          });
          suite.parent._afterEachScenarioFns.forEach(function(afterEachScenarioFn) {
            suite.afterAll('afterEachScenario', _skipPending(afterEachScenarioFn, suite));
            var hooksArray = suite._afterAll;
            hooksArray[hooksArray.length - 1].subtype = 'afterEachScenario';
          });
        }

        suites.unshift(suite);
        if (!fn) {
          // We need to add a dummy test or Mocha will not emit any suite related event
          // and the suite title would not be printed. Anyway, this test will be
          // ignored by the gherkin-like reporters
          var test = new Test('Scenario w/o implementation');
          test.file = file;
          suite.addTest(test);
        } else if (dataset) {
          // Scenario with variants, create a 'suite' per variant
          dataset.filter(function(variant) {
            return !variant.skip;  // Remove skipped variants
          }).forEach(function(variant, index) {
            var variantTitle = LABELS.variant + ' #' + (index + 1);
            if (variant.desc) {
              variantTitle += ': ' + variant.desc;
            }
            _createVariant(variantTitle, variant, fn);
          });
        } else {
          // Scenario w/o variants
          _createVariant(LABELS.variant + ': ' + title, null, fn);
        }
        suites.shift();

        if (options.only) {
          suite.tags.only = true;
          mocha.options.grep = 'only';
        }

        return suite;
      };
    }

    function _createVariant(title, variant, fn) {
      var suite = Suite.create(suites[0], title);
      suite.type = 'variant';
      suite.dummy = !variant;
      variant = variant || {};
      suite.tags = {};
      suite.manual = variant.manual || suite.parent.manual || false;
      if (suite.manual) {
        suite.tags.manual = true;
        suite.parent.hasManualChildren = suite.parent.parent.hasManualChildren = true;
        suite.parent.tags.manual = true;
        suite.parent.parent.tags.manual = true;
      }
      if (suite.manual || variant.minorBug) {
        suite.pending = true;
      } else {
        suite.file = file;
      }

      suites.unshift(suite);
      fn.call(suite, suite.dummy ? undefined : variant);
      suites.shift();

      if (variant.minorBug) {
        suite.minorBug(variant.minorBug);
      }
      if (variant.majorBug) {
        suite.majorBug(variant.majorBug);
      }
      if (variant.tag) {
        suite.tag(variant.tag);
      }
      if (variant.only) {
        suite.tags.only = true;
        mocha.options.grep = 'only';
      }

      return suite;
    }

    /**
     * Define a "scenario" with the given `title`, `dataset`,
     * and callback `fn` containing nested "steps".
     */

    context.scenario = _createScenario({});
    context.scenario.only = _createScenario({only: true});
    context.scenario.skip = _createScenario({skip: true});
    context.scenario.manual = _createScenario({manual: true});
    context.scenario.manual.skip = _createScenario({manual: true, skip: true});

    function _createStep(options) {
      return function(title, fn) {
        // A step must be inside a Variant, though from the point of view of the coder
        // steps are inside scenarios
        if (suites[0].type !== 'variant') {
          throw new Error('A ' + options.type + ' step must be inside a Scenario');
        }

        // Skipped steps are ignored
        if (options.skip) {
          return new Test();
        }

        var _fn = fn;
        if (options.manual || suites[0].pending) {
          _fn = null;  // Pending test, won't be executed
        }
        if (!options.async && _fn instanceof Function && !_fn.length) {
          // Only when the step has not been called with the .async modifier,
          // and fn is a Function, and such a function does not have any arguments
          _fn = sync.asyncIt(_fn);
        }

        var test = new Test(LABELS[options.type] + ': ' + title, _fn);
        test.file = file;
        suites[0].addTest(test);
        test.subtype = options.type;
        test.manual = options.manual || !fn || test.parent.manual || false;
        if (test.manual) {
          test.parent.hasManualChildren = test.parent.parent.hasManualChildren =
              test.parent.parent.parent.hasManualChildren = true;
          test.parent.tags.manual = true;
          test.parent.parent.tags.manual = true;
          test.parent.parent.parent.tags.manual = true;
        }

        return test;
      };
    }

    /**
     * Describe a step with the given `title`
     * and callback `fn` acting as a thunk.
     */

    context.given = _createStep({type: 'given'});
    context.given.async = _createStep({type: 'given', async: true});
    context.given.skip = _createStep({type: 'given', skip: true});
    context.given.manual = _createStep({type: 'given', manual: true});
    context.given.manual.skip = _createStep({type: 'given', manual: true, skip: true});
    context.when = _createStep({type: 'when'});
    context.when.async = _createStep({type: 'when', async: true});
    context.when.skip = _createStep({type: 'when', skip: true});
    context.when.manual = _createStep({type: 'when', manual: true});
    context.when.manual.skip = _createStep({type: 'when', manual: true, skip: true});
    context.then = _createStep({type: 'then'});
    context.then.async = _createStep({type: 'then', async: true});
    context.then.skip = _createStep({type: 'then', skip: true});
    context.then.manual = _createStep({type: 'then', manual: true});
    context.then.manual.skip = _createStep({type: 'then', manual: true, skip: true});
    context.and = _createStep({type: 'and'});
    context.and.async = _createStep({type: 'and', async: true});
    context.and.skip = _createStep({type: 'and', skip: true});
    context.and.manual = _createStep({type: 'and', manual: true});
    context.and.manual.skip = _createStep({type: 'and', manual: true, skip: true});
    context.but = _createStep({type: 'but'});
    context.but.async = _createStep({type: 'but', async: true});
    context.but.skip = _createStep({type: 'but', skip: true});
    context.but.manual = _createStep({type: 'but', manual: true});
    context.but.manual.skip = _createStep({type: 'but', manual: true, skip: true});

    /**
     * Wrap a function to be executed only when the related suite is not pending (or any of its parents).
     *
     * @param {Function} fn - The function to be wrapped.
     * @param {Suite} suite - The suite (feature, scenario or variant) whose pending state will determine
     *   whether the fn will be executed or not.
     * @return {Function}
     * @private
     */
    function _skipPending(fn, suite) {
      return function() {
        if (!suite.isPending()) {
          fn.call();
        }
      };
    }

    function _createAllHook(options) {
      return function(fn) {
        // This hook must be outside a Feature and never inside a Feature or Scenario
        if (!suites[0].root) {
          throw new Error('A ' + options.type + 'All hook must be outside any Feature or Scenario');
        }
        if (!options.async && fn instanceof Function && !fn.length) {
          // Only when the hook has not been called with the .async modifier,
          // and fn is a Function, and such a function does not have any arguments
          fn = sync.asyncIt(fn);
        }

        suites[0][options.type + 'All'](options.type + 'All', fn);
        var hooksArray = suites[0]['_' + options.type + 'All'];
        hooksArray[hooksArray.length - 1].subtype = options.type + 'All';
      };
    }

    function _createFeatureHook(options) {
      return function(fn) {
        // This hook must be inside a Feature and not inside a Scenario
        if (suites[0].type !== 'feature') {
          throw new Error(options.type + 'Feature hook must be inside a Feature');
        }
        if (!options.async && fn instanceof Function && !fn.length) {
          // Only when the hook has not been called with the .async modifier,
          // and fn is a Function, and such a function does not have any arguments
          fn = sync.asyncIt(fn);
        }
        if (!suites[0].pending) {
          suites[0][options.type + 'All'](options.type + 'Feature', _skipPending(fn, suites[0]));
          var hooksArray = suites[0]['_' + options.type + 'All'];
          hooksArray[hooksArray.length - 1].subtype = options.type + 'Feature';
        }
      };
    }

    function _createEachScenarioHook(options) {
      // A beforeEachScenario/afterEachScenario hook can be understood as a beforeScenario/afterScenario hook for each
      // one of the scenarios. The only issue is that hooks defined before the scenario definition must be stored to be
      // added at scenario creation time.
      return function(fn) {
        // This hook must be inside a Feature and not inside a Scenario
        if (suites[0].type !== 'feature') {
          throw new Error('A ' + options.type + 'EachScenario hook must be inside a Feature');
        }
        if (!options.async && fn instanceof Function && !fn.length) {
          // Only when the hook has not been called with the .async modifier,
          // and fn is a Function, and such a function does not have any arguments
          fn = sync.asyncIt(fn);
        }
        if (suites[0].suites.length === 0) {
          // Scenarios have not been created yet, we'll only store hook's functions into
          // feature._beforeEachScenarioFns/feature._afterEachScenarioFns arrays.
          // This happens when hooks are defined before the scenario definition.
          suites[0]['_' + options.type + 'EachScenarioFns'].push(fn);
        } else {
          // Scenarios have been already created, and we can directly add the hook to each scenario.
          // This happens when hooks are defined after the scenario definition.
          suites[0].suites.forEach(function(scenario) {
            if (!scenario.pending) {
              scenario[options.type + 'All'](options.type + 'EachScenario', _skipPending(fn, scenario));
              var hooksArray = scenario['_' + options.type + 'All'];
              hooksArray[hooksArray.length - 1].subtype = options.type + 'EachScenario';
            }
          });
        }
      };
    }

    function _createScenarioHook(options) {
      // beforeScenario/afterScenario are defined inside variants but we want them to be executed inside scenarios,
      // so we'll add the hooks to the scenario, that is, the variant's parent
      return function(fn) {
        // This hook must be inside a Variant, though from the point of view of the coder
        // this type of hooks are inside scenarios
        if (suites[0].type !== 'variant') {
          throw new Error('A ' + options.type + 'Scenario hook must be inside a Scenario');
        }
        // Scenario-level hooks needs to be added only once although they are present in each variant
        if (suites[0].parent.suites.length === 1) {
          if (!options.async && fn instanceof Function && !fn.length) {
            // Only when the hook has not been called with the .async modifier,
            // and fn is a Function, and such a function does not have any arguments
            fn = sync.asyncIt(fn);
          }
          if (!suites[0].parent.pending) {
            suites[0].parent[options.type + 'All'](options.type + 'Scenario', _skipPending(fn, suites[0].parent));
            var hooksArray = suites[0].parent['_' + options.type + 'All'];
            hooksArray[hooksArray.length - 1].subtype = options.type + 'Scenario';
          }
        }
      };
    }

    function _createEachVariantHook(options) {
      return function(fn) {
        // This hook must be inside a Variant, though from the point of view of the coder
        // this type of hooks are inside scenarios
        if (suites[0].type !== 'variant') {
          throw new Error('A ' + options.type + 'EachVariant hook must be inside a Scenario');
        }
        if (!options.async && fn instanceof Function && !fn.length) {
          // Only when the hook has not been called with the .async modifier,
          // and fn is a Function, and such a function does not have any arguments
          fn = sync.asyncIt(fn);
        }
        if (!suites[0].pending) {
          suites[0][options.type + 'All'](options.type + 'EachVariant', _skipPending(fn, suites[0]));
          var hooksArray = suites[0]['_' + options.type + 'All'];
          hooksArray[hooksArray.length - 1].subtype = options.type + 'EachVariant';
        }
      };
    }

    /**
     * Hooks
     */

    context.beforeAll = _createAllHook({type: 'before'});
    context.beforeAll.async = _createAllHook({type: 'before', async: true});
    context.beforeFeature = _createFeatureHook({type: 'before'});
    context.beforeFeature.async = _createFeatureHook({type: 'before', async: true});
    context.beforeEachScenario = _createEachScenarioHook({type: 'before'});
    context.beforeEachScenario.async = _createEachScenarioHook({type: 'before', async: true});
    context.beforeScenario = _createScenarioHook({type: 'before'});
    context.beforeScenario.async = _createScenarioHook({type: 'before', async: true});
    context.beforeEachVariant = _createEachVariantHook({type: 'before'});
    context.beforeEachVariant.async = _createEachVariantHook({type: 'before', async: true});

    context.afterEachVariant = _createEachVariantHook({type: 'after'});
    context.afterEachVariant.async = _createEachVariantHook({type: 'after', async: true});
    context.afterScenario = _createScenarioHook({type: 'after'});
    context.afterScenario.async = _createScenarioHook({type: 'after', async: true});
    context.afterEachScenario = _createEachScenarioHook({type: 'after'});
    context.afterEachScenario.async = _createEachScenarioHook({type: 'after', async: true});
    context.afterFeature = _createFeatureHook({type: 'after'});
    context.afterFeature.async = _createFeatureHook({type: 'after', async: true});
    context.afterAll = _createAllHook({type: 'after'});
    context.afterAll.async = _createAllHook({type: 'after', async: true});

    /**
     * Helpers
     */

    // eslint-disable-next-line jsdoc/require-description-complete-sentence
    /**
     * Get options passed to Tartare through the opts object passed to the Tartare constructor,
     * or as arguments when using the tartare CLI, or as env vars.
     * Opts object and CLI arguments supersede env vars.
     *
     * CLI arguments are converted to its lowerCamelCase form, removing the leading hyphens.
     * Tartare's env vars start with TARTARE_ and each word of the remaining var name is
     * expected to be separated by underscores. Env vars are converted to its lowerCamelCase
     * Ej: --my-cool-opt ==> myCoolOpt
     *     TARTARE_MY_COOL_OPT ==> myCoolOpt
     *
     * @param {?string} optName - Option name whose value is wanted (in the lowerCamelCase form).
     *          Without this parameter, this function returns an object with all the options passed in to Tartare.
     * @return {(string|Object)} An option value or all the options.
     */
    context.getTartareOptions = function getTartareOptions(optName) {
      return optName ? mocha.tartare.options[optName] : mocha.tartare.options;
    };

    /**
     * Wrap all functions exported by a module so now they can be invoked
     * in a synchronous (last argument is not a callback function)
     * or asynchronous (last argument is a callback function) way.
     *
     * @param {Object} module
     */
    context.synchronize = function synchronize(module) {
      Object.keys(module).forEach(function(name) {
        if (typeof module[name] === 'object') {
          synchronize(module[name]);
        } else if ((module[name] instanceof Function) && !module[name].dontSync) {
          sync(module, name);
        }
      });
    };

    /**
     * Wrap all functions exported by a module to convert them into WebDriver promises,
     * and enqueue them in the WebDriver Control Flow. Those functions can still be
     * called with a callback function to use them according to the CPS.
     *
     * @param {Object} module
     */
    context.promisize = function promisize(module) {
      if (!global.protractor) {
        // If Tartare is run out of Protractor, this function does nothing instead of throwing an error.
        // This is useful to run Tartare with the gherkin-md reporter without running Protractor.
        return;
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
          return global.protractor.promise.controlFlow().execute(function() {
            var d = new global.protractor.promise.Deferred();
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

      Object.keys(module).forEach(function(name) {
        if (typeof module[name] === 'object') {
          promisize(module[name]);
        } else if ((module[name] instanceof Function) && !module[name].dontPromisize) {
          module[name] = _promisize(module[name]);
        }
      });
    };

    /**
     * Wait some time before calling the cb function. It works like the native node.js setTimeout function
     * but the cb is the last argument, which allows this function to be "synchronized"
     * to be used in synchronous steps.
     *
     * @param {number} delay
     * @param cb
     */
    context.sleep = sync(function sleep(delay, cb) {
      setTimeout(cb, delay);
    });
  });
};
