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

var patches = require('./patches')
  , utils = require('../utils')
  , _ = require('underscore')
  , sync = require('synchronize')
  ;


var LABELS = {
  feature: 'Feature',
  scenario: 'Scenario',
  variant: 'Variant',
  given: 'Given',
  when: 'When',
  then: 'Then',
  and: 'And'
};

var rootSuite = null
  , currentFeature = null
  , currentScenario = null
  , currentVariant = null
  ;


function _hasFnArgs(fn) {
  if (!fn || typeof fn !== 'function') {
    throw new Error('fn is not a function');
  }
  return fn.toString().match(/^function\s*\((.*)\)/)[1] !== '';
}

var createFeature = function createFeature(options) {
  return function() {
    // A Feature must be at top level
    if (currentFeature || currentScenario) {
      throw new Error('A feature must be at top level');
    }

    // Skipped features are ignored
    if (options.skip) {
      return new patches.mocha.Suite();
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

    var _describe = (!fn || options.manual) ? describe.skip : describe;
    var suite = null;
    _describe(title, function() {
      suite = this;
      // Set the current feature to be used by createEachScenarioHook function
      currentFeature = this;
      currentFeature.type = 'feature';
      currentFeature.subtitle = subtitle;
      currentFeature.tags = {};
      currentFeature.manual = options.manual || !fn;
      if (currentFeature.manual) {
        currentFeature.tags['manual'] = true;
      }
      currentFeature._beforeEachScenarioFns = [];
      currentFeature._afterEachScenarioFns = [];
      if (!rootSuite) {
        // Set the Mocha's root suite, needed to manage global hooks, that are linked to this special suite
        rootSuite = currentFeature.parent;
        // Type all global hooks already defined
        rootSuite._beforeAll.forEach(function(hook) {
          if (hook.title.split(': ')[1] === 'beforeAll') {
            hook.subtype = 'beforeAll';
          }
        });
        rootSuite._afterAll.forEach(function(hook) {
          if (hook.title.split(': ')[1] === 'afterAll') {
            hook.subtype = 'afterAll';
          }
        });
      }

      if (!fn) {
        it('Feature w/o implementation');
      } else {
        fn.call(this);
      }

      currentFeature = null;
    });
    if (options.only) {
      suite.tags['only'] = true;
      // This flag will be used in the gherkin-base reporter to set a filter to only run suites tagged with 'only'
      global.tartareOnly = true;
    }
    return suite;
  };
};

module.exports.feature = createFeature({});
module.exports.feature.only = createFeature({ only: true });
module.exports.feature.skip = createFeature({ skip: true });
module.exports.feature.manual = createFeature({ manual: true });
module.exports.feature.manual.skip = createFeature({ manual: true, skip: true });


var createScenario = function createScenario(options) {
  return function(title, dataset, fn) {
    // A Scenario must be inside a Feature
    if (!currentFeature || currentScenario) {
      throw new Error('A scenario must be inside a Feature');
    }

    // Skipped scenarios are ignored
    if (options.skip) {
      return new patches.mocha.Suite();
    }

    if (dataset instanceof Function && !fn) {
      fn = dataset;
      dataset = null;
    }

    var _describe = (!fn || options.manual) ? describe.skip : describe;
    var suite = null;
    _describe(LABELS.scenario + ': ' + title, function() {
      suite = this;
      // Set the current scenario to be used by createScenarioHook function
      currentScenario = this;
      currentScenario.type = 'scenario';
      currentScenario.tags = {};
      currentScenario.manual = options.manual || !fn || currentScenario.parent.manual;
      if (currentScenario.manual) {
        currentScenario.tags['manual'] = true;
        currentFeature.hasManualChildren = true;
        currentFeature.tags['manual'] = true;
      }

      // Add beforeEachScenario/afterEachScenario hooks as beforeScenario/afterScenario for each scenario.
      // This will add those hooks when they are defined before the scenario definition. For those hooks defined
      // after the scenario definition, the createEachScenarioHook function will add them directly to the scenarios
      if (!currentScenario.pending) {
        currentFeature._beforeEachScenarioFns.forEach(function (beforeEachScenarioFn) {
          // Call suite's beforeAll method, which is the method called by Mocha's before keyword
          currentScenario.beforeAll.call(currentScenario, 'beforeEachScenario', beforeEachScenarioFn);
          var hooksArray = currentScenario['_beforeAll'];
          hooksArray[hooksArray.length - 1].subtype = 'beforeEachScenario';
        });
        currentFeature._afterEachScenarioFns.forEach(function (afterEachScenarioFn) {
          // Call suite's afterAll method, which is the method called by Mocha's after keyword
          currentScenario.afterAll.call(currentScenario, 'afterEachScenario', afterEachScenarioFn);
          var hooksArray = currentScenario['_afterAll'];
          hooksArray[hooksArray.length - 1].subtype = 'afterEachScenario';
        });
      }

      if (!fn) {
        it('Scenario w/o implementation');
      } else if (!dataset) {
        // Scenario w/o variants
        describe(LABELS.variant + ': ' + title, function() {
          currentVariant = this;
          currentVariant.type = 'variant';
          currentVariant.dummy = true;
          currentVariant.tags = {};
          currentVariant.manual = currentVariant.parent.manual || false;
          fn.call(this);
          currentVariant = null;
        });
      } else {
        // Scenario with variants, create a 'describe' per variant
        dataset.forEach(function(variant, index) {
          // Skipped variants are ignored
          if (variant.skip) {
            return;
          }
          var variantTitle = LABELS.variant + ' #' + (index + 1);
          if (variant.desc) {
            variantTitle += ': ' + variant.desc;
          }
          var _describe = (variant.manual || variant.minorBug) ? describe.skip : describe;
          var suite = null;
          _describe(variantTitle, function() {
            suite = this;
            currentVariant = this;
            currentVariant.type = 'variant';
            currentVariant.tags = {};
            currentVariant.manual = variant.manual || currentVariant.parent.manual || false;
            if (currentVariant.manual) {
              currentVariant.tags['manual'] = true;
              currentScenario.hasManualChildren = currentFeature.hasManualChildren = true;
              currentScenario.tags['manual'] = true;
              currentFeature.tags['manual'] = true;
            }
            if (variant.majorBug || variant.minorBug) {
              currentVariant.bugId = variant.majorBug || variant.minorBug;
              currentVariant.tags['bug'] = true;
            }
            fn.call(this, variant);
            currentVariant = null;
          });
          suite.tag(variant.tag);
          if (variant.only) {
            suite.tags['only'] = true;
            // This flag will be used in the gherkin-base reporter to set a filter to only run suites tagged with 'only'
            global.tartareOnly = true;
          }
        });
      }

      currentScenario = null;
    });
    if (options.only) {
      suite.tags['only'] = true;
      // This flag will be used in the gherkin-base reporter to set a filter to only run suites tagged with 'only'
      global.tartareOnly = true;
    }
    return suite;
  };
};

module.exports.scenario = createScenario({});
module.exports.scenario.only = createScenario({ only: true });
module.exports.scenario.skip = createScenario({ skip: true });
module.exports.scenario.manual = createScenario({ manual: true });
module.exports.scenario.manual.skip = createScenario({ manual: true, skip: true });


var createStep = function createStep(options) {
  return function(title, fn) {
    // A step must be inside a Scenario
    if (!currentScenario) {
      throw new Error('A ' + options.type + ' step must be inside a Scenario');
    }

    // Skipped steps are ignored
    if (options.skip) {
      return;
    }

    title = LABELS[options.type] + ': ' + title;

    if (options.manual) {
      fn = null;  // Pending test, won't be executed
    }
    if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
      // Only when the step has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
      fn = sync.asyncIt(fn);
    }
    var step = (fn instanceof Function) ? it(title, fn) : it(title);
    if (!step) {
      // Workaround: selenium-webdriver wraps the mocha's 'it' function not returning the created test :-(
      step = currentVariant.tests[currentVariant.tests.length - 1];
    }
    step.subtype = options.type;
    step.manual = options.manual || !fn || step.parent.manual || false;
    if (step.manual) {
      currentVariant.hasManualChildren = currentScenario.hasManualChildren = currentFeature.hasManualChildren = true;
      currentVariant.tags['manual'] = true;
      currentScenario.tags['manual'] = true;
      currentFeature.tags['manual'] = true;
    }
  };
};

module.exports.given = createStep({ type: 'given' });
module.exports.given.async = createStep({ type: 'given', async: true });
module.exports.given.skip = createStep({ type: 'given', skip: true });
module.exports.given.manual = createStep({ type: 'given', manual: true });
module.exports.given.manual.skip = createStep({ type: 'given', manual: true, skip: true });
module.exports.when = createStep({ type: 'when' });
module.exports.when.async = createStep({ type: 'when', async: true });
module.exports.when.skip = createStep({ type: 'when', skip: true });
module.exports.when.manual = createStep({ type: 'when', manual: true });
module.exports.when.manual.skip = createStep({ type: 'when', manual: true, skip: true });
module.exports.then = createStep({ type: 'then' });
module.exports.then.async = createStep({ type: 'then', async: true });
module.exports.then.skip = createStep({ type: 'then', skip: true });
module.exports.then.manual = createStep({ type: 'then', manual: true });
module.exports.then.manual.skip = createStep({ type: 'then', manual: true, skip: true });
module.exports.and = createStep({ type: 'and' });
module.exports.and.async = createStep({ type: 'and', async: true });
module.exports.and.skip = createStep({ type: 'and', skip: true });
module.exports.and.manual = createStep({ type: 'and', manual: true });
module.exports.and.manual.skip = createStep({ type: 'and', manual: true, skip: true });


var createAllHook = function createAllHook(options) {
  return function(fn) {
    // This hook must be outside a Feature and never inside a Feature or Scenario
    if (currentFeature || currentScenario) {
      throw new Error('A ' + options.type + 'All hook must be outside any Feature or Scenario');
    }
    if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
      // Only when the hook has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
      fn = sync.asyncIt(fn);
    }
    // Call Mocha hook
    global[options.type](options.type + 'All', fn);
    // Call current suite's beforeAll/afterAll method, which is the method called by Mocha's before/after keywords
    if (rootSuite) {
      var hooksArray = rootSuite['_' + options.type + 'All'];
      hooksArray[hooksArray.length - 1].subtype = options.type + 'All';
    }
  };
};

var createFeatureHook = function createFeatureHook(options) {
  return function(fn) {
    // This hook must be inside a Feature and not inside a Scenario
    if (!currentFeature || currentScenario) {
      throw new Error(options.type + 'Feature hook must be inside a Feature');
    }
    if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
      // Only when the hook has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
      fn = sync.asyncIt(fn);
    }
    if (!currentFeature.pending) {
      // Call Mocha hook
      global[options.type](options.type + 'Feature', fn);
      var hooksArray = currentFeature['_' + options.type + 'All'];
      hooksArray[hooksArray.length - 1].subtype = options.type + 'Feature';
    }
  };
};

var createEachScenarioHook = function createEachScenarioHook(options) {
  // A beforeEachScenario/afterEachScenario hook can be understood as a beforeScenario/afterScenario hook for each
  // one of the scenarios. The only issue is that hooks defined before the scenario definition must be stored to be
  // added at scenario creation time.
  return function(fn) {
    // This hook must be inside a Feature and not inside a Scenario
    if (!currentFeature || currentScenario) {
      throw new Error('A ' + options.type + 'EachScenario hook must be inside a Feature');
    }
    if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
      // Only when the hook has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
      fn = sync.asyncIt(fn);
    }
    if (currentFeature.suites.length === 0) {
      // Scenarios have not been created yet, we'll only store hook's functions into
      // feature._beforeEachScenarioFns/feature._afterEachScenarioFns arrays
      // This happens when hooks are defined before the scenario definition
      currentFeature['_' + options.type + 'EachScenarioFns'].push(fn);
    } else {
      // Scenarios have been already created, we can directly add the hook to each scenario
      // This happens when hooks are defined after the scenario definition
      currentFeature.suites.forEach(function(scenario) {
        if (!scenario.pending) {
          // Call suite's beforeAll/afterAll method, which is the method called by Mocha's before/after keywords
          scenario[options.type + 'All'].call(scenario, options.type + 'EachScenario', fn);
          var hooksArray = scenario['_' + options.type + 'All'];
          hooksArray[hooksArray.length - 1].subtype = options.type + 'EachScenario';
        }
      });
    }
  };
};

var createScenarioHook = function createScenarioHook(options) {
  // Since we want to create a hook on a describe/suite that is different from 'this' object
  // (because beforeScenario/afterScenario are defined inside variants and we want them to be executed inside scenarios),
  // we use Mocha's internal methods to add these hooks to the suite pointed by currentScenario variable
  return function(fn) {
    // This hook must be inside a Scenario
    if (!currentScenario) {
      throw new Error('A ' + options.type + 'Scenario hook must be inside a Scenario');
    }
    // Scenario-level hooks needs to be added only once although they are present in each variant
    if (currentScenario.suites.length === 1) {
      if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
        // Only when the hook has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
        fn = sync.asyncIt(fn);
      }
      if (!currentScenario.pending) {
        // Call current suite's beforeAll/afterAll method, which is the method called by Mocha's before/after keywords
        currentScenario[options.type + 'All'].call(currentScenario, options.type + 'Scenario', fn);
        var hooksArray = currentScenario['_' + options.type + 'All'];
        hooksArray[hooksArray.length - 1].subtype = options.type + 'Scenario';
      }
    }
  };
};

var createEachVariantHook = function createEachVariantHook(options) {
  return function(fn) {
    // This hook must be inside a Scenario
    if (!currentScenario) {
      throw new Error('A ' + options.type + 'EachVariant hook must be inside a Scenario');
    }
    if (!options.async && fn instanceof Function && !_hasFnArgs(fn)) {
      // Only when the hook has not been called with the .async modifier, and fn is a Function, and such a function does not have any arguments
      fn = sync.asyncIt(fn);
    }
    if (!currentVariant.pending) {
      // Call Mocha hook
      global[options.type](options.type + 'EachVariant', fn);
      var hooksArray = currentVariant['_' + options.type + 'All'];
      hooksArray[hooksArray.length - 1].subtype = options.type + 'EachVariant';
    }
  };
};

module.exports.beforeAll = createAllHook({ type: 'before' });
module.exports.beforeAll.async = createAllHook({ type: 'before', async: true });
module.exports.beforeFeature = createFeatureHook({ type: 'before' });
module.exports.beforeFeature.async = createFeatureHook({ type: 'before', async: true });
module.exports.beforeEachScenario = createEachScenarioHook({ type: 'before' });
module.exports.beforeEachScenario.async = createEachScenarioHook({ type: 'before', async: true });
module.exports.beforeScenario = createScenarioHook({ type: 'before' });
module.exports.beforeScenario.async = createScenarioHook({ type: 'before', async: true });
module.exports.beforeEachVariant = createEachVariantHook({ type: 'before' });
module.exports.beforeEachVariant.async = createEachVariantHook({ type: 'before', async: true });

module.exports.afterEachVariant = createEachVariantHook({ type: 'after' });
module.exports.afterEachVariant.async = createEachVariantHook({ type: 'after', async: true });
module.exports.afterScenario = createScenarioHook({ type: 'after' });
module.exports.afterScenario.async = createScenarioHook({ type: 'after', async: true });
module.exports.afterEachScenario = createEachScenarioHook({ type: 'after' });
module.exports.afterEachScenario.async = createEachScenarioHook({ type: 'after', async: true });
module.exports.afterFeature = createFeatureHook({ type: 'after' });
module.exports.afterFeature.async = createFeatureHook({ type: 'after', async: true });
module.exports.afterAll = createAllHook({ type: 'after' });
module.exports.afterAll.async = createAllHook({ type: 'after', async: true });


for (var name in module.exports) {
  if (module.exports.hasOwnProperty(name)) {
    global[name] = module.exports[name];
  }
}
