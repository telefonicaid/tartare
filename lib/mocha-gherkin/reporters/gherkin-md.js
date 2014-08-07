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
  var progress = {
    features: { total: 0, current: 0 },
    scenarios: { total: 0, current: 0 },
    variants: { total: 0, current: 0 }
  };

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

  function stderrCR() {
    tty.isatty(2) && process.stderr.write('\u001b[2K') && process.stderr.write('\u001b[0G');
  }

  function printProgress() {
    stderrCR();
    process.stderr.write(util.format('Features: %d% | Scenarios: %d% | Variants: %d%',
      Math.round(progress.features.current / progress.features.total * 100),
      Math.round(progress.scenarios.current / progress.scenarios.total * 100),
      progress.variants.total !== 0 ? Math.round(progress.variants.current / progress.variants.total * 100) : 0
    ));
  }

  function printStats(stats) {
    console.log('|   | passed | failed | pending | TOTAL |');
    console.log('|---|-------:|-------:|--------:|------:|');
    console.log('| Features (US) | ' + stats.features.passed + ' | ' + stats.features.failed + ' | ' + stats.features.pending + ' | ' +
      (stats.features.passed + stats.features.failed + stats.features.pending) + ' |');
    console.log('| Scenarios (TC) | ' + stats.scenarios.passed + ' | ' + stats.scenarios.failed + ' | ' + stats.scenarios.pending + ' | ' +
      (stats.scenarios.passed + stats.scenarios.failed + stats.scenarios.pending) + ' |');
    console.log('| Variants (DS) | ' + stats.variants.passed + ' | ' + stats.variants.failed + ' | ' + stats.variants.pending + ' | ' +
      (stats.variants.passed + stats.variants.failed + stats.variants.pending) + ' |');
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
        if (scenario.type !== 'scenario' || scenario.parent.originalPending) {
          return;
        }
        console.log('  - [' + scenario.title + '](#' + slug(scenario.fullTitle()) + ')');
      });
    });
    console.log();
  }

  function printFailures(failures) {
    function _getTitleHierarchy(test) {
      var titles = [];
      var current = test;
      while (!current.root) {
        if (current.type !== 'variant' || !current.dummy) {
          titles.unshift(current.type === 'hook' ? current.subtype + ' hook' : current.title);
        }
        current = current.parent;
      }
      return titles;
    }

    console.log(os.EOL + '---');
    console.log('# FAILURES');
    failures.forEach(function(test) {
      console.log('- ' + _getTitleHierarchy(test).join(' | '));
    });
  }

  runner.on('start', function() {
    progress.features.total = runner.suite.suites.reduce(function(previous, suite) {
      return previous + (suite.type === 'feature' ? 1 : 0);
    }, 0);
    progress.features.current = 0;
  });

  runner.on('feature', function(feature) {
    progress.features.current++;
    progress.scenarios.total = feature.suites.reduce(function(previous, suite) {
      return previous + (suite.type === 'scenario' ? 1 : 0);
    }, 0);
    progress.scenarios.current = 0;
    printProgress();
  });

  runner.on('scenario', function(scenario) {
    progress.scenarios.current++;
    progress.variants.total = scenario.suites.reduce(function(previous, suite) {
      return previous + (suite.type === 'variant' ? 1 : 0);
    }, 0);
    progress.variants.current = 0;
    printProgress();
  });

  runner.on('variant', function(variant) {
    progress.variants.current++;
    printProgress();
  });

  runner.on('end', function() {
    stderrCR();

    // Modify Mocha's tree to merge features with the same title
    var featuresCache = {};
    runner.suite.suites.forEach(function(feature, index, features) {
      if (feature.type !== 'feature' || featuresCache[feature.title]) {
        // Skip if the feature has been previously processed
        return;
      }
      featuresCache[feature.title] = feature;  // Add the feature to the cache

      // Look for scenarios belonging to the same feature, that is, belonging to features with the same title that the current one
      for (var i = index + 1; i < features.length; i++) {
        if (features[i] && features[i].type === 'feature' && features[i].title === feature.title) {
          feature.suites = feature.suites.concat(features[i].suites);
          delete features[i];
        }
      }
    });

    // Ensure the report is not affected by some process writing in stdout
    console.log();
    console.log();

    printStats(self.stats);

    printTOC(runner.suite);

    runner.suite.suites.forEach(function(feature) {
      if (feature.type !== 'feature') {
        return;
      }
      var title = feature.title;
      if (feature.originalPending) {
        title = '~~' + title + '~~';
      } else if (feature.pending) {
        title = '_' + title + '_';
      }
      console.log('<a name="' + slug(feature.fullTitle()) + '"></a>');
      console.log('## ' + title);
      feature.subtitle.forEach(function(line) {
        console.log('- ' + line);
      });
      console.log(os.EOL + '---');

      feature.suites.forEach(function(scenario) {
        if (scenario.type !== 'scenario' || scenario.parent.originalPending) {
          return;
        }
        var title = scenario.title;
        if (scenario.originalPending) {
          title = '~~' + title + '~~';
        } else if (scenario.pending) {
          title = '_' + title + '_';
        }
        console.log('<a name="' + slug(scenario.fullTitle()) + '"></a>');
        console.log('### ' + title);

        scenario.suites.forEach(function(variant) {
          if (variant.type !== 'variant' || variant.parent.originalPending) {
            return;
          }
          if (!variant.dummy) {
            var title = variant.title;
            if (variant.originalPending) {
              title = '~~' + title + '~~';
            } else if (variant.pending) {
              title = '_' + title + '_';
            }
            console.log('**' + title + '**');
          }

          variant.tests.forEach(function(step, index, steps) {
            if (!step.subtype || step.parent.originalPending) {
              return;
            }
            var str = '';
            if (index === 0) {
              str += '<pre><code>';  // First step
            }
            var title = step.title;
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
    });
    console.log();

    if (self.failures.length) {
      printFailures(self.failures);
      console.log();
    }

    process.exit(0);
  });

}
util.inherits(GherkinMdReporter, GherkinBase);


module.exports = GherkinMdReporter;
