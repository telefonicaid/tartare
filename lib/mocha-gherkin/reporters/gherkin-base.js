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

var util = require('util')
  , Base = require('mocha/lib/reporters/base')
  ;


/**
 * Mocha reporter to process tests written using Gherkin syntax.
 * This reporter is not intended to be directly used, but to be inherited
 * by other reporters that actually prints the report.
 * It also calculates real metrics based on Features, Scenarios and Variants.
 */

function GherkinBase(runner) {
  Base.call(this, runner);

  var self = this;
  self.failures = [];
  self.stats = {
    features: { passed: 0, pending: 0, failed: 0 },
    scenarios: { passed: 0, pending: 0, failed: 0 },
    variants: { passed: 0, pending: 0, failed: 0 },
    steps: { passed: 0, pending: 0, failed: 0 }
  };
  self.variantsPerFeature = {};
  var featuresCache = {};


  function isStep(test) {
    return (test.type === 'test' && [ 'given', 'when', 'then', 'and' ].indexOf(test.subtype) !== -1);
  }

  function isHook(test) {
    return (test.type === 'hook' && test.subtype);
  }

  /**
   * Calculate whether a suite is pending. A suite is pending if:
   *   - It has been defined with the .skip modifier.
   *   - It is a variant and at least ONE of its steps is pending.
   *   - It is a feature or scenario and ALL of its children are pending.
   *
   * @param suite
   * @returns {*}
   */
  function isPending(suite) {
    if (suite.pending) {
      return true;
    }
    var children = (suite.type === 'variant' ? suite.tests : suite.suites);
    var _isPending = children.map(function(child) {
      return child.pending;
    }).reduce(function(previous, value) {
      return (suite.type === 'variant' ? previous || value : previous && value);
    }, suite.type !== 'variant');
    if (_isPending) {
      suite.pending = true;
    }
    return _isPending;
  }

  /**
   * Calculate whether a suite has passed. A suite has passed if:
   *   - It is a variant and ALL of its steps and hooks have passed.
   *   - It is a feature or a scenario and ALL of its children and hooks have passed (a pending children counts as passed).
   *
   * @param suite
   * @returns {Object}
   */
  function hasPassed(suite) {
    function _hasFailures(runnables) {
      return runnables.map(function(runnable) {
        return (runnable.state === 'failed');
      }).reduce(function(previous, value) {
          return previous || value;
        }, false);
    }

    var children = (suite.type === 'variant' ? suite.tests : suite.suites);
    var _hasPassed = children.map(function(child) {
      return (suite.type === 'variant' ? child.state === 'passed' : child.pending || child.state === 'passed');
    }).reduce(function(previous, value) {
      return previous && value;
    }, true);
    _hasPassed = _hasPassed && !_hasFailures(suite._beforeAll) && !_hasFailures(suite._afterAll);
    suite.state = _hasPassed ? 'passed' : 'failed';
    return _hasPassed;
  }


  runner.on('suite', function(suite){
    runner.emit(suite.type || 'describe', suite);
  });

  runner.on('suite end', function(suite){
    if (suite.type) {
      // Update stats
      var suiteStats = self.stats[suite.type + 's'];

      if (suite.type !== 'feature' || !featuresCache[suite.title]) {
        // Stats are always counted for scenarios, variants and steps,
        // and are only counted for non-cached features
        if (suite.type === 'feature') {
          // Add the feature to the cache
          featuresCache[suite.title] = [ suite ];
        }
        if (isPending(suite)) {
          suiteStats.pending++;
        }
        else if (hasPassed(suite)) {
          suiteStats.passed++;
        }
        else  {
          suiteStats.failed++;
        }
      } else {
        // For those features whose title matches an already processed feature, update cached feature's properties and correct stats
        // This allows having several features with the same title, that will be considered as an only one

        // Add the current feature to the array that store all the features sharing the same title
        var cachedFeature = featuresCache[suite.title];
        cachedFeature.push(suite);

        /*
            |   cached    |   current   | new cached  |     action      |
            |-------------|-------------|-------------|-----------------|
            | Not pending |   Pending   | Not pending |                 |
            | Not pending | Not pending | Not pending |                 |
            |   Pending   |   Pending   |   Pending   |                 |
            |   Pending   | Not pending | Not Pending | stats.pending++ |
         */
        // If the cached feature was pending and the current one is not, the cached feature becomes not pending
        if (cachedFeature[0].pending && !isPending(suite)) {
          suiteStats.pending--;
        }
        // The cached feature only will be pending if it already was pending and the current feature is also pending
        var cachedFeatureWasPending = cachedFeature[0].pending;
        cachedFeature[0].pending = cachedFeature[0].pending && suite.pending;

        // All the features sharing the same title must have the same pending property
        for (var i = 1; i < cachedFeature.length; i++) {
          cachedFeature[i].pending = cachedFeature[0].pending;
        }

        // If the current feature is not pending, let's review the state
        // Note that if it is pending, it is not changing the state of the cached feature
        if (!suite.pending) {
          // Correct stats depending on whether the feature has changed from pending to not pending
          /*
             |        |         |            | new cached feature went from pending to not pending? |
             | cached | current | new cached |               No                |         Yes        |
             |--------|---------|------------|---------------------------------|--------------------|
             | Passed | Passed  |   Passed   |                                 |   stats.passed++   |
             | Passed | Failed  |   Failed   | stats.passed-- / stats.failed++ |   stats.failed++   |
             | Failed | Passed  |   Failed   |                                 |                    |
             | Failed | Failed  |   Failed   |                                 |                    |
           */
          if (cachedFeatureWasPending) {
            // The cached feature never contributed to the state's stats, so the new state's stats depends only on the current feature
            if (hasPassed(suite)) {
              suiteStats.passed++;
            } else  {
              suiteStats.failed++;
            }
            // Since the feature was formerly pending, its state depends only on the new feature's state
            cachedFeature[0].state = suite.state;
          } else {
            // The state's stats only change when the cached feature was passing and the current feature has failed
            hasPassed(suite);
            if (cachedFeature[0].state === 'passed' && suite.state === 'failed') {
              suiteStats.passed--;
              suiteStats.failed++;
            }
            // The feature's state is 'passed' only if it was already 'passed' and the new feature has passed
            cachedFeature[0].state = (cachedFeature[0].state === 'passed' && suite.state === 'passed') ? 'passed' : 'failed';
          }
          // All the features sharing the same title must have the same state
          for (var i = 1; i < cachedFeature.length; i++) {
            cachedFeature[i].state = cachedFeature[0].state;
          }
        }
      }

      // Update variants per feature (for metrics)
      if (suite.type === 'variant') {
        var parentFeature = suite.parent.parent.title;
        self.variantsPerFeature[parentFeature] = self.variantsPerFeature[parentFeature] || { ok: 0, pending: 0 };
        if (isPending(suite)) {
          self.variantsPerFeature[parentFeature].pending++;
        }
        else {
          self.variantsPerFeature[parentFeature].ok++;
        }
      }
    }

    runner.emit((suite.type || 'describe') + ' end', suite);
  });

  runner.on('pending', function(test){
    if (isStep(test)) {
      test.title = test.title.toString();  // Needed to work with selenium-webdriver
      self.stats.steps.pending++;
      runner.emit('step pending', test);
    }
    else if (test.parent.type === 'feature' || test.parent.type === 'scenario') {
      // Do nothing: It's a dummy 'it' whose parent is a pending feature/scenario without function
    }
    else {
      runner.emit('it pending', test);
    }
  });

  runner.on('test', function(test){
    if (isStep(test)) {
      runner.emit('step', test);
    }
    else {
      runner.emit('it', test);
    }
  });

  runner.on('pass', function(test){
    if (isStep(test)) {
      self.stats.steps.passed++;
      runner.emit('step pass', test);
    }
    else {
      runner.emit('it pass', test);
    }
  });

  runner.on('fail', function(test, err){
    self.failures.push(test);

    if (isStep(test)) {
      self.stats.steps.failed++;
      runner.emit('step fail', test, err);
    }
    else if (isHook(test)) {
      runner.emit('hook fail', test, err);
    }
    else {
      runner.emit('it fail', test, err);
    }
  });

}
util.inherits(GherkinBase, Base);


module.exports = GherkinBase;
module.exports.Base = Base;
