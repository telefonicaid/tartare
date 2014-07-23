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
  , sync = require('synchronize')
  ;

var utils = require('../utils')
  , LABELS = require('./common').LABELS;

var rootSuite = null
  , currentFeature = null
  , currentScenario = null
  , currentVariant = null
  ;


var createFeature = function createFeature(options) {
  return function() {
    // A Feature must be at top level
    if (currentFeature || currentScenario) {
      throw new Error('A feature must be at top level');
    }

    var feature = arguments[0];
    var story = arguments.length >= 3 ? _.toArray(arguments).slice(1, arguments.length - 1) : [];
    var fn = arguments[arguments.length - 1];

    var title = LABELS.feature + ': ' + feature;
    story.forEach(function(line) {
      title += '\n' + line;
    });

    var _describe = options.skip ? describe.skip : options.only ? describe.only : describe;
    _describe(title, function() {
      // Set the current feature to be used by createEachScenarioHook function
      currentFeature = this;
      currentFeature.type = 'feature';
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

      fn.call(this);

      currentFeature = null;
    });
  };
};

module.exports.feature = createFeature({});
module.exports.feature.only = createFeature({ only: true });
module.exports.feature.skip = createFeature({ skip: true });


var createScenario = function createScenario(options) {
  return function(title, dataset, fn) {
    // A Scenario must be inside a Feature
    if (!currentFeature || currentScenario) {
      throw new Error('A scenario must be inside a Feature');
    }

    if (!dataset && !fn) {
      // This is an unimplemented scenario
      title = LABELS.scenario + ': ' + title;
      describe.skip(title, function() {
        // Set the current scenario to be used by createScenarioHook function
        currentScenario = this;
        currentScenario.type = 'scenario';
        it('Pending');
        currentScenario = null;

      });
      return;  // We've finished
    }

    // The rest of the function is for when the scenario is implemented (w/ or w/o variants)
    if (!fn && dataset instanceof Function) {
      // scenario w/o variants
      fn = dataset;
      dataset = null;
    }

    // Create the scenario structure
    var _describe = options.skip ? describe.skip : options.only ? describe.only : describe;
    _describe(LABELS.scenario + ': ' + title, function() {
      // Set the current scenario to be used by createScenarioHook function
      currentScenario = this;
      currentScenario.type = 'scenario';

      // Add beforeEachScenario/afterEachScenario hooks as beforeScenario/afterScenario for each scenario.
      // This will add those hooks when they are defined before the scenario definition. For those hooks defined
      // after the scenario definition, the createEachScenarioHook function will add them directly to the scenarios
      currentFeature._beforeEachScenarioFns.forEach(function(beforeEachScenarioFn) {
        if (!currentScenario.pending) {
          // Call suite's beforeAll method, which is the method called by Mocha's before keyword
          currentScenario.beforeAll.call(currentScenario, 'beforeEachScenario', beforeEachScenarioFn);
          var hooksArray = currentScenario['_beforeAll'];
          hooksArray[hooksArray.length - 1].subtype = 'beforeEachScenario';
        }
      });
      currentFeature._afterEachScenarioFns.forEach(function(afterEachScenarioFn) {
        if (!currentScenario.pending) {
          // Call suite's afterAll method, which is the method called by Mocha's after keyword
          currentScenario.afterAll.call(currentScenario, 'afterEachScenario', afterEachScenarioFn);
          var hooksArray = currentScenario['_afterAll'];
          hooksArray[hooksArray.length - 1].subtype = 'afterEachScenario';
        }
      });

      if (!dataset) {
        // Scenario w/o variants
        describe(LABELS.variant + ': ' + title, function() {
          currentVariant = this;
          currentVariant.type = 'variant';
          fn.call(this);
          currentVariant = null;
        });
      } else {
        // Scenario with variants, create a 'describe' per variant
        dataset.forEach(function(variant, index) {
          var variantTitle = LABELS.variant + ' #' + (index + 1);
          var desc = utils.formatTestDescription(variant.desc, variant.tag, variant.bugId);
          if (desc) {
            variantTitle += ': ' + desc;
          }
          var _describe = variant.skip ? describe.skip : variant.only ? describe.only : describe;
          _describe(variantTitle, function() {
            currentVariant = this;
            currentVariant.type = 'variant';
            fn.call(this, variant);
            currentVariant = null;
          });
        });
      }

      currentScenario = null;
    });
  };
};

module.exports.scenario = createScenario({});
module.exports.scenario.only = createScenario({ only: true });
module.exports.scenario.skip = createScenario({ skip: true });


var createStep = function createStep(options) {
  return function(title, fn) {
    // A step must be inside a Scenario
    if (!currentScenario) {
      throw new Error('A ' + options.type + ' step must be inside a Scenario');
    }

    title = LABELS[options.type] + ': ' + title;

    if (!options.async) {
      fn = sync.asyncIt(fn);
    }
    var step = it(title, fn);
    if (!step) {
      // Workaround: selenium-webdriver wraps the mocha's 'it' function not returning the created test :-(
      step = currentVariant.tests[currentVariant.tests.length - 1];
    }
    step.subtype = options.type;
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


var createAllHook = function createAllHook(options) {
  return function(fn) {
    // This hook must be outside a Feature and never inside a Feature or Scenario
    if (currentFeature || currentScenario) {
      throw new Error('A ' + options.type + 'All hook must be outside any Feature or Scenario');
    }
    if (!options.async) {
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
    if (!options.async) {
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
    if (!options.async) {
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
      if (!options.async) {
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
    if (!options.async) {
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
