/*

 Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U

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

/* eslint-disable no-unused-vars */
/* eslint-disable new-cap */

var util = require('util'),
    os = require('os'),
    _ = require('underscore'),
    clc = require('cli-color'),
    GherkinBase = require('./gherkin-base');

var styles = {
  dark: {
    featureTitle: clc.green.bold.underline,
    featureTitlePending: clc.green.bold.underline.italic,
    featureSubtitle: clc.white,
    featureSubtitlePending: clc.white.italic,
    scenario: clc.greenBright,
    scenarioPending: clc.greenBright.italic,
    variant: clc.cyan,
    variantPending: clc.cyan.italic,
    stepLabel: clc.yellow,
    stepText: clc.whiteBright,
    stepLabelPending: clc.yellow.italic,
    stepTextPending: clc.whiteBright.italic,
    stepLabelFailed: clc.red,
    stepTextFailed: clc.red,
    hookFailed: clc.red,
    duration: clc.magenta.italic.bold,
    symbol: clc.green,
    symbolPending: clc.blackBright,
    symbolFailed: clc.red,
    symbolManual: clc.cyanBright,
    failureText: clc.white.bold,
    failureMessage: clc.red,
    failureExpected: clc.bgGreenBright,
    failureExpectedValue: clc.greenBright,
    failureActual: clc.bgRedBright,
    failureActualValue: clc.redBright,
    failureStack: clc.white
  },
  clear: {
    featureTitle: clc.blue.bold.underline,
    featureTitlePending: clc.blue.bold.underline.italic,
    featureSubtitle: clc.blackBright,
    featureSubtitlePending: clc.blackBright.italic,
    scenario: clc.blueBright,
    scenarioPending: clc.blueBright.italic,
    variant: clc.green,
    variantPending: clc.green.italic,
    stepLabel: clc.yellow,
    stepText: clc.black,
    stepLabelPending: clc.yellow.italic,
    stepTextPending: clc.black.italic,
    stepLabelFailed: clc.red,
    stepTextFailed: clc.red,
    hookFailed: clc.red,
    duration: clc.magenta.italic.bold,
    symbol: clc.green,
    symbolPending: clc.blackBright,
    symbolFailed: clc.red,
    symbolManual: clc.cyanBright,
    failureText: clc.black.bold,
    failureMessage: clc.red,
    failureExpected: clc.bgGreen.whiteBright,
    failureExpectedValue: clc.green,
    failureActual: clc.bgRedBright.whiteBright,
    failureActualValue: clc.redBright,
    failureStack: clc.blackBright
  }
};

/**
 * Mocha reporter that outputs coloured Gherkin syntax using stdout/stderr
 */
function GherkinReporter(runner) {
  GherkinBase.call(this, runner);

  var self = this;
  var indents = 0;

  function getDecoratedTitle(suite) {
    var title = suite.title;
    if (suite.manual) {
      title += ' [Manual]';
    }
    if (suite.bugId) {
      title += ' [Bug Id: ' + suite.bugId + ']';
    }
    return title;
  }

  function indent(str, tabNumber, mustTrim) {
    tabNumber = tabNumber || indents - 1;
    return str.split(os.EOL).map(function(line) {
      return new Array(tabNumber + 1).join('  ') + (mustTrim ? line.trim() : line);
    }).join(os.EOL);
  }

  function pad(str, len, paddingStr) {
    var padding = new Array(len + 1).join(paddingStr || ' ');
    return String(padding + str).slice(-padding.length);
  }

  function format(obj, style) {
    if (obj === null) {
      return style.italic('null');
    }
    if (obj === undefined) {
      return style.italic('undefined');
    }
    if (obj instanceof Buffer) {
      return style(obj.toString());
    }
    return style(util.inspect(obj));
  }

  function getFullTitle(runnable) {
    var titles = [];
    var current = runnable;
    while (!current.root) {
      if (current.type !== 'variant' || !current.dummy) {
        titles.unshift(current.type === 'hook' ? current.subtype + ' hook' : current.title);
      }
      current = current.parent;
    }
    return titles.join(' --> ');
  }

  function printFailures(failures) {
    console.error();
    failures.forEach(function(test, i) {
      // msg
      var err = test.err,
          message = err.message || '',
          stack = err.stack || message,
          index = stack.indexOf(message) + message.length,
          actual = err.actual,
          expected = err.expected,
          name = err.name;

      // uncaught error
      if (err.uncaught) {
        name = 'Uncaught ' + name;
      }

      // indent stack trace without message
      stack = stack.slice(index ? index + 1 : index);

      // print test info splitting full title
      var titles = [];
      var current = test;
      while (!current.root) {
        if (current.type !== 'variant' || !current.dummy) {
          titles.unshift(current.type === 'hook' ? current.subtype + ' hook' : current.title);
        }
        current = current.parent;
      }
      console.error(styles.failureText((i + 1) + ') ' + getFullTitle(test)));
      console.error();

      // print message Error
      console.error(styles.failureMessage(indent(err.name + ': ' + message, 1)));
      if (err.name === 'AssertionError') {
        // print Expected vs Actual in case of Assertion Error
        console.error(os.EOL + indent(styles.failureExpected('Expected:'), 2) + os.EOL + os.EOL +
          indent(format(expected, styles.failureExpectedValue), 3)
        );
        console.error(os.EOL + indent(styles.failureActual('Actual:'), 2) + os.EOL + os.EOL +
          indent(format(actual, styles.failureActualValue), 3)
        );
      }

      //print stack trace
      console.error(os.EOL + styles.failureStack(indent(stack, 2, true)) + os.EOL + os.EOL);
    });
  }

  function last(suite) {
    return suite === suite.parent.suites.slice(-1)[0];
  }

  function formatDuration(duration) {
    function formatMillisec(msec) {
      return msec ? '.' + pad(msec, 3, '0') : '';
    }

    var _duration = new Date(duration);
    if (duration < 1000) {
      return duration + 'ms';
    }
    if (duration < 60 * 1000) {
      return _duration.getUTCSeconds() + formatMillisec(_duration.getUTCMilliseconds()) + 's';
    }
    if (duration < 60 * 60 * 1000) {
      return _duration.getUTCMinutes() + ':' +
          pad(_duration.getUTCSeconds(), 2, '0') + formatMillisec(_duration.getUTCMilliseconds());
    }
    return _duration.getUTCHours() + ':' +
        pad(_duration.getUTCMinutes(), 2, '0') + ':' +
        pad(_duration.getUTCSeconds(), 2, '0') + formatMillisec(_duration.getUTCMilliseconds());
  }

  runner.on('start', function() {
    styles = styles[global.getTartareOptions('theme') || 'dark'];
    if (!GherkinBase.Base.useColors) {
      _.map(styles, function(value, key) {
        styles[key] = function(str) { return str; };
      });
    }

    console.log();
  });

  runner.on('feature', function(feature) {
    ++indents;

    console.log(indent(
        (feature.pending ? styles.featureTitlePending : styles.featureTitle)(getDecoratedTitle(feature)))
    );
    feature.subtitle.forEach(function(subtitleLine) {
      console.log(indent(
          '    ' + (feature.pending ? styles.featureSubtitlePending : styles.featureSubtitle)(subtitleLine))
      );
    });
    if (feature.suites.length) {
      console.log();
    }
  });

  runner.on('scenario', function(scenario) {
    ++indents;
    console.log(indent((scenario.pending ? styles.scenarioPending : styles.scenario)(getDecoratedTitle(scenario))));
  });

  runner.on('variant', function(variant) {
    ++indents;
    if (variant.dummy) {
      return;  // Dummy variants (those used in scenarios w/o variants) are not shown
    }

    console.log(indent((variant.pending ? styles.variantPending : styles.variant)(getDecoratedTitle(variant))));
  });

  runner.on('feature end', function(feature) {
    if (!feature.pending) {
      console.log(indent(styles.duration('Feature duration: ' + formatDuration(feature.duration))));
    }
    --indents;
    console.log();
  });

  runner.on('scenario end', function(scenario) {
    if (!scenario.pending) {
      console.log(indent(styles.duration('Scenario duration: ' + formatDuration(scenario.duration))));
    }
    --indents;
    if (!last(scenario) || !scenario.suites.length) {
      console.log();
    }
  });

  runner.on('variant end', function(variant) {
    if (!variant.dummy && !variant.pending) {
      console.log(indent(styles.duration('Variant duration: ' + formatDuration(variant.duration))));
    }
    --indents;
    if (!last(variant) || variant.pending) {
      console.log();
    }
  });

  runner.on('step pending', function(step) {
    var title = step.title;
    if (step.manual) {
      title += ' [Manual]';
    }

    var pos = title.indexOf(': ');
    console.log(indent(
      styles.symbolPending('  ◊ ') +
      styles.stepLabelPending(pad(title.substring(0, pos), 5) + ': ') +
      styles.stepTextPending(title.substring(pos + 2))));
  });

  runner.on('step', function(step) {
    var pos = step.title.indexOf(': ');
    process.stdout.write(indent(
      styles.symbol('  ◦ ') +
      styles.stepLabel(pad(step.title.substring(0, pos), 5) + ': ') +
      styles.stepText(step.title.substring(pos + 2))));
  });

  runner.on('step pass', function(step) {
    var pos = step.title.indexOf(': ');
    GherkinBase.Base.cursor.CR();
    console.log(indent(
      styles.symbol('  ' + GherkinBase.Base.symbols.ok + ' ') +
      styles.stepLabel(pad(step.title.substring(0, pos), 5) + ': ') +
      styles.stepText(step.title.substring(pos + 2)) +
      styles.duration(' (' + formatDuration(step.duration) + ')')));
  });

  runner.on('step fail', function(step, err) {
    var pos = step.title.indexOf(': ');
    GherkinBase.Base.cursor.CR();
    console.log(indent(
      styles.symbolFailed('  ' + GherkinBase.Base.symbols.err + ' ' + self.failures.length + ') ') +
      styles.stepLabelFailed(step.title.substring(0, pos) + ': ') +
      styles.stepTextFailed(step.title.substring(pos + 2)))
    );
  });

  runner.on('hook fail', function(hook, err) {
    GherkinBase.Base.cursor.CR();
    console.log(indent(
      styles.symbolFailed('  ' + GherkinBase.Base.symbols.err + ' ' + self.failures.length + ') ') +
      styles.hookFailed(hook.subtype + ' hook'))
    );
  });

  runner.on('end', function() {
    console.log();

    // REPORT
    console.log(pad('', 12) + '| ' + styles.symbol('passed') + ' | ' + styles.symbolFailed('failed') + ' | ' +
      ' TOTAL | ' + styles.symbolManual('manual') + ' |');
    console.log('  ' + pad('', 47, '-'));
    _.each(self.stats, function(value, key) {
      console.log('  ' + pad(key[0].toUpperCase() + key.slice(1), 9) + ' | ' +
        styles.symbol(pad(value.passed, 6)) + ' | ' +
        styles.symbolFailed(pad(value.failed, 6)) + ' | ' +
        pad(value.passed + value.failed, 6) + ' | ' +
        styles.symbolManual(pad(value.manual, 6)) + ' | '
      );
    });
    console.log();

    // METRICS
    var str;
    console.log();
    console.log('  METRICS:');
    str = '   · Product size (Σ features): ' + (self.stats.features.passed + self.stats.features.failed);
    if (self.stats.features.manual) {
      str += ' (' + self.stats.features.manual + ' manual)';
    }
    console.log(str);
    str = '   · Test-set size (Σ test-variants): ' + (self.stats.variants.passed + self.stats.variants.failed);
    if (self.stats.variants.manual) {
      str += ' (' + self.stats.variants.manual + ' manual)';
    }
    console.log(str);
    str = '   · Coverage (Σ test-variants/feature): [';
    if (_.size(self.variantsPerFeature)) {
      _.each(self.variantsPerFeature, function(value, key) {
        str += value.total;
        if (value.manual) {
          str += ' (' + value.manual + ' manual)';
        }
        str += ', ';
      });
      str = str.slice(0, -2) + ']';
    }
    else {
      str += ']';
    }
    console.log(str);
    console.log();

    console.log(styles.duration('  Total duration: ' + formatDuration(self.duration)));
    console.log();

    // FAILURES DETAIL
    if (self.failures.length) {
      console.error();
      console.error('  FAILURES:');
      printFailures(self.failures);
    }

    // Print warnings related to variants that are passing/failing but are/aren't marked as bugs
    if (self.warningBuggyTestPassed.length) {
      console.error();
      console.error(styles.failureMessage(
          '*** WARNING: The following variants are marked as bugs but they are passing ***')
      );
      console.error(styles.failureMessage(
          '==============================================================================='
      ));
      self.warningBuggyTestPassed.forEach(function(variant) {
        console.error(styles.failureText(' - ' + getFullTitle(variant)));
      });
      console.error();
    }

    if (self.warningNonBuggyTestFailed.length) {
      console.error();
      console.error(styles.failureMessage(
          '*** WARNING: The following variants are failing but they are not marked as bugs ***'
      ));
      console.error(styles.failureMessage(
          '==================================================================================='
      ));
      self.warningNonBuggyTestFailed.forEach(function(variant) {
        console.error(styles.failureText(' - ' + getFullTitle(variant)));
      });
      console.error();
    }

    console.error();
  });

}
util.inherits(GherkinReporter, GherkinBase);

module.exports = GherkinReporter;
