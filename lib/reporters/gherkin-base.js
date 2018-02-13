/*

 Copyright 2015-2018 Telefonica Investigación y Desarrollo, S.A.U

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

var util = require('util');
var Base = require('mocha/lib/reporters/base');

/**
 * Mocha reporter to process tests written using the Gherkin syntax.
 * This reporter is not intended to be directly used, but to be inherited
 * by other reporters that actually prints the report.
 * It also calculates real metrics based on Features, Scenarios and Variants.
 *
 * @param {Runner} runner
 */
function GherkinBase(runner) {
  Base.call(this, runner);

  var self = this;
  self.failures = [];
  self.warningBuggyTestPassed = [];
  self.warningNonBuggyTestFailed = [];
  self.stats = {
    features: {passed: 0, failed: 0, manual: 0},
    scenarios: {passed: 0, failed: 0, manual: 0},
    variants: {passed: 0, failed: 0, manual: 0},
    steps: {passed: 0, failed: 0, manual: 0}
  };
  self.variantsPerFeature = {};

  function isStep(test) {
    return (test.type === 'test' && ['given', 'when', 'then', 'and', 'but'].indexOf(test.subtype) !== -1);
  }

  function isHook(test) {
    return (test.type === 'hook' && test.subtype);
  }

  /**
   * Merge stats for features sharing the same name.
   * @param {Object} stats
   */
  function mergeFeatureStats(stats) {
    var uniqueTitleFeatures = [];
    runner.suite.suites.forEach(function(feature) {
      if (feature.type !== 'feature' || !runner._grep.test(feature.fullTitle())) {
        return;
      }

      var masterFeature = uniqueTitleFeatures[feature.title];
      if (masterFeature) {
        if (masterFeature.buggy && feature.buggy) {
          stats.features.failed--;
        } else {
          stats.features.passed--;
        }
        if (feature.buggy) {
          masterFeature.buggy = true;
        }
        if (masterFeature.manual || feature.manual) {
          stats.features.manual--;
        }
        if (!feature.manual) {
          masterFeature.manual = false;
        }
      } else {
        uniqueTitleFeatures[feature.title] = {
          manual: feature.manual,
          buggy: feature.buggy
        };
      }
    });
  }

  runner.on('start', function() {
    self.start = new Date();
  });

  runner.on('suite', function(suite) {
    if (!suite.type) {
      return;
    }

    suite.start = new Date();
    suite.manual = suite.manual || suite.hasManualChildren;
    runner.emit(suite.type, suite);
  });

  runner.on('suite end', function(suite) {
    if (!suite.type) {
      return;
    }

    if (suite.buggy) {
      self.stats[suite.type + 's'].failed++;
    } else {
      self.stats[suite.type + 's'].passed++;
    }
    if (suite.manual) {
      self.stats[suite.type + 's'].manual++;
    }

    if (suite.type === 'variant') {
      // Count variants per feature
      var parentFeature = suite.parent.parent.title;
      self.variantsPerFeature[parentFeature] = self.variantsPerFeature[parentFeature] || {total: 0, manual: 0};
      self.variantsPerFeature[parentFeature].total++;
      if (suite.manual) {
        self.variantsPerFeature[parentFeature].manual++;
      }

      // Look for warnings
      var allTestPassed = suite.tests.map(function passed(test) {
        return test.pending || test.state === 'passed';
      }).reduce(function(prev, curr) {
        return prev && curr;
      }, true);
      var someTestFailed = suite.tests.map(function failed(test) {
        return !test.pending && test.state === 'failed';
      }).reduce(function(prev, curr) {
        return prev || curr;
      }, false);
      if (!suite.pending && suite.bugId && allTestPassed) {
        self.warningBuggyTestPassed.push(suite);
      }
      if (!suite.bugId && someTestFailed) {
        self.warningNonBuggyTestFailed.push(suite);
      }
    }

    suite.duration = new Date() - suite.start;
    runner.emit(suite.type + ' end', suite);
  });

  runner.on('pending', function(test) {
    if (isStep(test)) {
      if (test.manual) {
        self.stats.steps.manual++;
      }
      self.stats.steps.passed++;
      runner.emit('step pending', test);
    }
  });

  runner.on('test', function(test) {
    if (isStep(test)) {
      runner.emit('step', test);
    }
  });

  runner.on('pass', function(test) {
    if (isStep(test)) {
      self.stats.steps.passed++;
      runner.emit('step pass', test);
    }
  });

  runner.on('fail', function(test, err) {
    self.failures.push(test);

    if (isStep(test)) {
      self.stats.steps.failed++;
      test.parent.parent.parent.buggy = test.parent.parent.buggy = test.parent.buggy = test.buggy = true;
      runner.emit('step fail', test, err);
    } else if (isHook(test)) {
      runner.emit('hook fail', test, err);
    }
  });

  runner.on('end', function() {
    mergeFeatureStats(self.stats);
    self.duration = new Date() - self.start;
  });
}
util.inherits(GherkinBase, Base);

module.exports = GherkinBase;
module.exports.Base = Base;
