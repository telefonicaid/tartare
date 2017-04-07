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

var util = require('util');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var GherkinBase = require('./gherkin-base');

/**
 * Mocha reporter that outputs Gherkin syntax in Markdown format.
 * @param {Runner} runner
 * @param {Object} options
 */
function GherkinMdReporter(runner, options) {
  GherkinBase.call(this, runner);

  var self = this;

  if (options.reporterOptions && options.reporterOptions.output) {
    mkdirp.sync(path.dirname(options.reporterOptions.output));
    self.fileStream = fs.createWriteStream(options.reporterOptions.output);
  }

  self.bugIdPrefix = (options.reporterOptions && options.reporterOptions.bugidLink) || options.bugidLink || null;
  if (self.bugIdPrefix && self.bugIdPrefix.indexOf('%s') === -1) {
    self.bugIdPrefix += '%s';
  }

  self.staticStats = {  // These stats are calculated over the Mocha's tree, without running the tests
    features: {passed: 0, failed: 0, manual: 0},
    scenarios: {passed: 0, failed: 0, manual: 0},
    variants: {passed: 0, failed: 0, manual: 0},
    steps: {total: 0, manual: 0}
  };
  self.majorBugs = {};
  self.minorBugs = {};

  function write(line) {
    line = line || '';
    if (self.fileStream) {
      self.fileStream.write(line + '\n');
    } else {
      console.log(line);
    }
  }

  function getLinkFromBugId(bugId) {
    if (self.bugIdPrefix) {
      return '[' + bugId + '](' + self.bugIdPrefix.replace('%s', bugId) + ')';
    }
    return bugId;
  }

  function getDecoratedTitle(suite) {
    var title = suite.title;
    if (suite.manual) {
      title += ' [Manual]';
    }
    if (suite.bugId) {
      title += ' [Bug Id: ' + getLinkFromBugId(suite.bugId) + ']';
    }
    return title;
  }

  function pad(str, len, paddingStr) {
    var padding = new Array(len).join(paddingStr || ' ');
    return String(padding + str).slice(-padding.length);
  }

  function slug(str) {
    return str
      .toLowerCase()
      .replace(/ +/g, '-')
      .replace(/[^-\w]/g, '');
  }

  function isEmpty(arr) {
    if (!arr || !arr.length) {
      return true;
    }
    return !arr.reduce(function(previous, current) {
      return previous || current;
    }, false);
  }

  function printStats(stats) {
    write('|   | Passed | Failed | TOTAL | Manual |');
    write('|---|-------:|-------:|------:|-------:|');
    write('| Features (US) | ' + stats.features.passed + ' | ' + stats.features.failed + ' | ' +
      (stats.features.passed + stats.features.failed) + ' | ' + stats.features.manual + ' | ');
    write('| Scenarios (TC) | ' + stats.scenarios.passed + ' | ' + stats.scenarios.failed + ' | ' +
      (stats.scenarios.passed + stats.scenarios.failed) + ' | ' + stats.scenarios.manual + ' | ');
    write('| Variants (DS) | ' + stats.variants.passed + ' | ' + stats.variants.failed + ' | ' +
      (stats.variants.passed + stats.variants.failed) + ' | ' + stats.variants.manual + ' | ');
    write('| Steps |  |  | ' + stats.steps.total + ' | ' + stats.steps.manual + ' | ');
    write();
  }

  function printTOC(rootSuite) {
    write('# TOC');
    rootSuite.suites.forEach(function(feature) {
      if (feature.type !== 'feature') {
        return;
      }
      write('- [' + feature.title + '](#' + slug(feature.fullTitle()) + ')');
      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        write('  - [' + scenario.title + '](#' + slug(scenario.fullTitle()) + ')');
      });
    });
    write();
    write('---');
  }

  function printBugs(bugs, title) {
    function _printBuggySuite(suite) {
      write('    - [' + suite.title + '](#' + slug(suite.fullTitle()) + ')');
    }

    write();
    write('# ' + title);

    for (var bugId in bugs) {
      if (bugs.hasOwnProperty(bugId)) {
        write('- Bug Id: ' + getLinkFromBugId(bugId) + ':');
        bugs[bugId].forEach(_printBuggySuite);
      }
    }
  }

  runner.on('start', function() {
    // Ensure the report is not affected by some process writing in stdout
    write();
    write();

    // Modify Mocha's tree to remove suites that do not match the filter
    // It also converts suites in "manual" when they have manual children
    runner.suite.suites.forEach(function(feature, featureIndex, features) {
      if (feature.type !== 'feature') {
        return;
      }
      feature.suites.forEach(function(scenario, ScenarioIndex, scenarios) {
        if (scenario.type !== 'scenario') {
          return;
        }
        scenario.suites.forEach(function(variant, variantIndex, variants) {
          if (variant.type !== 'variant') {
            return;
          }
          if (!runner._grep.test(variant.fullTitle())) {
            delete variants[variantIndex];
            return;
          }
          variant.manual = variant.manual || variant.hasManualChildren;
        });

        if (!runner._grep.test(scenario.fullTitle()) && isEmpty(scenario.suites)) {
          delete scenarios[ScenarioIndex];
          return;
        }
        scenario.manual = scenario.manual || scenario.hasManualChildren;
      });

      if (!runner._grep.test(feature.fullTitle()) && isEmpty(feature.suites)) {
        delete features[featureIndex];
        return;
      }
      feature.manual = feature.manual || feature.hasManualChildren;
    });

    // Modify Mocha's tree to merge features with the same title
    var alreadyProcessedFeatures = {};
    runner.suite.suites.forEach(function(feature, index, features) {
      if (feature.type !== 'feature' || alreadyProcessedFeatures[feature.title]) {
        // Skip if the feature has been previously processed
        return;
      }
      alreadyProcessedFeatures[feature.title] = true;  // Mark the feature as already processed

      // Look for scenarios belonging to the same feature, that is,
      // belonging to features with the same title that the current one
      for (var i = index + 1; i < features.length; i++) {
        if (features[i] && features[i].type === 'feature' && features[i].title === feature.title) {
          feature.suites = feature.suites.concat(features[i].suites);
          if (features[i].manual) {
            feature.manual = true;
          }
          if (features[i].buggy) {
            feature.buggy = true;
          }
          if (features[i].bugId) {
            feature.bugId = features[i].bugId;
          }
          delete features[i];
        }
      }
    });

    // Calculate stats and collect minor and major bugs
    runner.suite.suites.forEach(function(feature) {
      if (feature.type !== 'feature') {
        return;
      }
      if (feature.buggy) {
        self.staticStats.features.failed++;
      } else {
        self.staticStats.features.passed++;
      }
      if (feature.manual) {
        self.staticStats.features.manual++;
      }
      if (feature.bugId && feature.bugId !== feature.parent.bugId) {
        // bugId has not been inherited
        if (feature.buggy) {
          self.majorBugs[feature.bugId] = self.majorBugs[feature.bugId] || [];
          self.majorBugs[feature.bugId].push(feature);
        } else {
          self.minorBugs[feature.bugId] = self.minorBugs[feature.bugId] || [];
          self.minorBugs[feature.bugId].push(feature);
        }
      }

      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        if (scenario.buggy) {
          self.staticStats.scenarios.failed++;
        } else {
          self.staticStats.scenarios.passed++;
        }
        if (scenario.manual) {
          self.staticStats.scenarios.manual++;
        }
        if (scenario.bugId && scenario.bugId !== scenario.parent.bugId) {
          // bugId has not been inherited
          if (scenario.buggy) {
            self.majorBugs[scenario.bugId] = self.majorBugs[scenario.bugId] || [];
            self.majorBugs[scenario.bugId].push(scenario);
          } else {
            self.minorBugs[scenario.bugId] = self.minorBugs[scenario.bugId] || [];
            self.minorBugs[scenario.bugId].push(scenario);
          }
        }

        scenario.suites.forEach(function(variant) {
          if (variant.type !== 'variant') {
            return;
          }
          if (variant.buggy) {
            self.staticStats.variants.failed++;
          } else {
            self.staticStats.variants.passed++;
          }
          if (variant.manual) {
            self.staticStats.variants.manual++;
          }
          if (variant.bugId && variant.bugId !== variant.parent.bugId && !variant.dummy) {
            // bugId has not been inherited
            if (variant.buggy) {
              self.majorBugs[variant.bugId] = self.majorBugs[variant.bugId] || [];
              self.majorBugs[variant.bugId].push(variant);
            } else {
              self.minorBugs[variant.bugId] = self.minorBugs[variant.bugId] || [];
              self.minorBugs[variant.bugId].push(variant);
            }
          }

          // eslint-disable-next-line max-nested-callbacks
          variant.tests.forEach(function(step) {
            if (!step.subtype) {
              return;
            }
            self.staticStats.steps.total++;
            if (step.manual) {
              self.staticStats.steps.manual++;
            }
          });
        });
      });
    });

    printStats(self.staticStats);

    printTOC(runner.suite);

    // Print the test suite
    runner.suite.suites.forEach(function(feature) {
      if (feature.type !== 'feature') {
        return;
      }
      var title = getDecoratedTitle(feature);
      if (feature.pending) {
        title = '_' + title + '_';
      }
      write('<a name="' + slug(feature.fullTitle()) + '"></a>');
      write('## ' + title);
      feature.subtitle.forEach(function(line) {
        if (feature.pending) {
          line = '_' + line + '_';
        }
        write('- ' + line);
      });
      write();

      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        var scenarioTitle = getDecoratedTitle(scenario);
        if (scenario.pending) {
          scenarioTitle = '_' + scenarioTitle + '_';
        }
        write('<a name="' + slug(scenario.fullTitle()) + '"></a>');
        write('### ' + scenarioTitle);

        scenario.suites.forEach(function(variant) {
          if (variant.type !== 'variant') {
            return;
          }
          if (!variant.dummy) {
            var variantTitle = getDecoratedTitle(variant);
            if (variant.pending) {
              variantTitle = '_' + variantTitle + '_';
            }
            write('<a name="' + slug(variant.fullTitle()) + '"></a>');
            write('**' + variantTitle + '**');
          }

          // eslint-disable-next-line max-nested-callbacks
          variant.tests.forEach(function(step, index, steps) {
            if (!step.subtype) {
              return;
            }
            var str = '';
            if (index === 0) {
              str += '<pre><code>';  // First step
            }
            var stepTitle = step.title;
            if (step.manual) {
              stepTitle += ' [Manual]';
            }

            var pos = stepTitle.indexOf(':');
            stepTitle = '<b>' + pad(stepTitle.substring(0, pos + 1), 7) + '</b>' + stepTitle.substring(pos + 1);
            if (step.pending) {
              stepTitle = '<i>' + stepTitle + '</i>';
            }
            str += stepTitle;
            if (index === steps.length - 1) {
              str += '</code></pre>';  // Last step
            }
            write(str);
          });
          write();
        });
        if (scenario.pending) {
          write();
        }
      });
      if (feature.pending) {
        write();
      }
      write('---');
    });
    write();

    if (Object.keys(self.majorBugs).length) {
      printBugs(self.majorBugs, 'Major Bugs');
      write();
    }

    if (Object.keys(self.minorBugs).length) {
      printBugs(self.minorBugs, 'Minor Bugs');
      write();
    }

    // Remove the whole suite so the Mocha runner does not execute any test, and finish.
    runner.suite.suites = [];
  });
}
util.inherits(GherkinMdReporter, GherkinBase);

/**
 * Close the stream if it's a file.
 * @param {number} failures - Number of failures.
 * @param {Function} fn - Function to be invoked after the test suite is run.
 */
GherkinMdReporter.prototype.done = function(failures, fn) {
  if (this.fileStream) {
    this.fileStream.end(function() {
      fn(failures);
    });
  } else {
    fn(failures);
  }
};

module.exports = GherkinMdReporter;
