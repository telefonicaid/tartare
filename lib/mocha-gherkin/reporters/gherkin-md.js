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
  , tty = require('tty')
  , os = require('os')
  , GherkinBase = require('./gherkin-base')
  ;


/**
 * Mocha reporter that outputs Gherkin syntax in Markdown format
 */

function GherkinMdReporter(runner) {
  GherkinBase.call(this, runner);

  var self = this;
  var bugIdPrefix = getTartareOptions('bugidLink') || null;
  if (bugIdPrefix && bugIdPrefix.indexOf('%s') === -1) {
    bugIdPrefix += '%s';
  }

  var stats = {  // These stats are calculated over the Mocha's tree, without running the tests
    features: { passed: 0, failed: 0, manual: 0 },
    scenarios: { passed: 0, failed: 0, manual: 0 },
    variants: { passed: 0, failed: 0, manual: 0 },
    steps: { total: 0, manual: 0 }
  };
  var majorBugs = {};
  var minorBugs = {};


  function getLinkFromBugId(bugId) {
    if (bugIdPrefix) {
      return '[' + bugId + '](' + bugIdPrefix.replace('%s', bugId) + ')';
    } else {
      return bugId;
    }
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
    return !arr.reduce(function (previous, current) {
      return previous || current;
    }, false);
  }

  function printStats(stats) {
    console.log('|   | Passed | Failed | TOTAL | Manual |');
    console.log('|---|-------:|-------:|------:|-------:|');
    console.log('| Features (US) | ' + stats.features.passed + ' | ' + stats.features.failed + ' | ' +
      (stats.features.passed + stats.features.failed) + ' | ' + stats.features.manual + ' | ');
    console.log('| Scenarios (TC) | ' + stats.scenarios.passed + ' | ' + stats.scenarios.failed + ' | ' +
      (stats.scenarios.passed + stats.scenarios.failed) + ' | ' + stats.scenarios.manual + ' | ');
    console.log('| Variants (DS) | ' + stats.variants.passed + ' | ' + stats.variants.failed + ' | ' +
      (stats.variants.passed + stats.variants.failed) + ' | ' + stats.variants.manual + ' | ');
    console.log('| Steps |  |  | ' + stats.steps.total + ' | ' + stats.steps.manual + ' | ');
    console.log();
  }

  function printTOC(rootSuite) {
    console.log('# TOC');
    rootSuite.suites.forEach(function(feature) {
      if (feature.type !== 'feature') {
        return;
      }
      console.log('- [' + feature.title + '](#' + slug(feature.fullTitle()) + ')');
      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        console.log('  - [' + scenario.title + '](#' + slug(scenario.fullTitle()) + ')');
      });
    });
    console.log();
    console.log('---');
  }

  function printBugs(bugs, title) {
    console.log();
    console.log('# ' + title);

    for (var bugId in bugs) {
      if (bugs.hasOwnProperty(bugId)) {
        console.log('- Bug Id: ' + getLinkFromBugId(bugId) + ':');
        bugs[bugId].forEach(function (suite) {
          console.log('    - [' + suite.title + '](#' + slug(suite.fullTitle()) + ')');
        });
      }
    }
  }


  runner.on('start', function() {
    // Ensure the report is not affected by some process writing in stdout
    console.log();
    console.log();

    // Modify Mocha's tree to remove suites that do not match the filter
    // It also converts suites in "manual" when they have manual children
    runner.suite.suites.forEach(function(feature, index, features) {
      if (feature.type !== 'feature') {
        return;
      }
      feature.suites.forEach(function(scenario, index, scenarios) {
        if (scenario.type !== 'scenario') {
          return;
        }
        scenario.suites.forEach(function(variant, index, variants) {
          if (variant.type !== 'variant') {
            return;
          }
          if (!runner._grep.test(variant.fullTitle())) {
            return delete variants[index];
          }
          variant.manual = variant.manual || variant.hasManualChildren;
        });

        if (!runner._grep.test(scenario.fullTitle()) && isEmpty(scenario.suites)) {
          return delete scenarios[index];
        }
        scenario.manual = scenario.manual || scenario.hasManualChildren;
      });

      if (!runner._grep.test(feature.fullTitle()) && isEmpty(feature.suites)) {
        return delete features[index];
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

      // Look for scenarios belonging to the same feature, that is, belonging to features with the same title that the current one
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
        stats.features.failed++;
      } else {
        stats.features.passed++;
      }
      if (feature.manual) {
        stats.features.manual++;
      }
      if (feature.bugId && feature.bugId !== feature.parent.bugId) {
        // bugId has not been inherited
        if (feature.buggy) {
          majorBugs[feature.bugId] = majorBugs[feature.bugId] || [];
          majorBugs[feature.bugId].push(feature);
        } else {
          minorBugs[feature.bugId] = minorBugs[feature.bugId] || [];
          minorBugs[feature.bugId].push(feature);
        }
      }

      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        if (scenario.buggy) {
          stats.scenarios.failed++;
        } else {
          stats.scenarios.passed++;
        }
        if (scenario.manual) {
          stats.scenarios.manual++;
        }
        if (scenario.bugId && scenario.bugId !== scenario.parent.bugId) {
          // bugId has not been inherited
          if (scenario.buggy) {
            majorBugs[scenario.bugId] = majorBugs[scenario.bugId] || [];
            majorBugs[scenario.bugId].push(scenario);
          } else {
            minorBugs[scenario.bugId] = minorBugs[scenario.bugId] || [];
            minorBugs[scenario.bugId].push(scenario);
          }
        }

        scenario.suites.forEach(function(variant) {
          if (variant.type !== 'variant') {
            return;
          }
          if (variant.buggy) {
            stats.variants.failed++;
          } else {
            stats.variants.passed++;
          }
          if (variant.manual) {
            stats.variants.manual++;
          }
          if (variant.bugId && variant.bugId !== variant.parent.bugId && !variant.dummy) {
            // bugId has not been inherited
            if (variant.buggy) {
              majorBugs[variant.bugId] = majorBugs[variant.bugId] || [];
              majorBugs[variant.bugId].push(variant);
            } else {
              minorBugs[variant.bugId] = minorBugs[variant.bugId] || [];
              minorBugs[variant.bugId].push(variant);
            }
          }

          variant.tests.forEach(function(step) {
            if (!step.subtype) {
              return;
            }
            stats.steps.total++;
            if (step.manual) {
              stats.steps.manual++;
            }
          });
        });
      });
    });

    printStats(stats);

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
      console.log('<a name="' + slug(feature.fullTitle()) + '"></a>');
      console.log('## ' + title);
      feature.subtitle.forEach(function(line) {
        if (feature.pending) {
          line = '_' + line + '_';
        }
        console.log('- ' + line);
      });
      console.log();

      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario') {
          return;
        }
        var title = getDecoratedTitle(scenario);
        if (scenario.pending) {
          title = '_' + title + '_';
        }
        console.log('<a name="' + slug(scenario.fullTitle()) + '"></a>');
        console.log('### ' + title);

        scenario.suites.forEach(function(variant) {
          if (variant.type !== 'variant') {
            return;
          }
          if (!variant.dummy) {
            var title = getDecoratedTitle(variant);
            if (variant.pending) {
              title = '_' + title + '_';
            }
            console.log('<a name="' + slug(variant.fullTitle()) + '"></a>');
            console.log('**' + title + '**');
          }

          variant.tests.forEach(function(step, index, steps) {
            if (!step.subtype) {
              return;
            }
            var str = '';
            if (index === 0) {
              str += '<pre><code>';  // First step
            }
            var title = step.title;
            if (step.manual) {
              title += ' [Manual]';
            }

            var pos = title.indexOf(':');
            title = '<b>' + pad(title.substring(0, pos + 1), 7) + '</b>' + title.substring(pos + 1);
            if (step.pending) {
              title = '<i>' + title + '</i>';
            }
            str += title;
            if (index === steps.length - 1) {
              str += '</code></pre>';  // Last step
            }
            console.log(str);
          });
          console.log();
        });
        if (scenario.pending) {
          console.log();
        }
      });
      if (feature.pending) {
        console.log();
      }
      console.log('---');
    });
    console.log();

    if (Object.keys(majorBugs).length) {
      printBugs(majorBugs, 'Major Bugs');
      console.log();
    }

    if (Object.keys(minorBugs).length) {
      printBugs(minorBugs, 'Minor Bugs');
      console.log();
    }

    process.exit(0);
  });

}
util.inherits(GherkinMdReporter, GherkinBase);


module.exports = GherkinMdReporter;
