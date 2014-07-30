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
  , os = require('os')
  , _ = require('underscore')
  , clc = require('cli-color')
  , GherkinBase = require('./gherkin-base')
  ;


var styles = {
  dark: {
    featureTitle: clc.green.bold.underline,
    featureTitlePending: clc.green.bold.strike,
    featureSubtitle: clc.white,
    featureSubtitlePending: clc.white.strike,
    scenario: clc.greenBright,
    scenarioPending: clc.greenBright.strike,
    variant: clc.cyan,
    variantPending: clc.cyan.strike,
    stepLabel: clc.yellow,
    stepText: clc.whiteBright,
    stepLabelPending: clc.yellow.strike,
    stepTextPending: clc.whiteBright.strike,
    stepLabelFailed: clc.red,
    stepTextFailed: clc.red,
    hookFailed: clc.red,
    duration: clc.magenta.italic.bold,
    symbol: clc.green,
    symbolPending: clc.blackBright,
    symbolFailed: clc.red,
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
    featureTitlePending: clc.blue.bold.strike,
    featureSubtitle: clc.blackBright,
    featureSubtitlePending: clc.blackBright.strike,
    scenario: clc.blueBright,
    scenarioPending: clc.blueBright.strike,
    variant: clc.green,
    variantPending: clc.green.strike,
    stepLabel: clc.yellow,
    stepText: clc.black,
    stepLabelPending: clc.yellow.strike,
    stepTextPending: clc.whiteBright.strike,
    stepLabelFailed: clc.red,
    stepTextFailed: clc.red,
    hookFailed: clc.red,
    duration: clc.magenta.italic.bold,
    symbol: clc.green,
    symbolPending: clc.blackBright,
    symbolFailed: clc.red,
    failureText: clc.black.bold,
    failureMessage: clc.red,
    failureExpected: clc.bgGreen.whiteBright,
    failureExpectedValue: clc.green,
    failureActual: clc.bgRedBright.whiteBright,
    failureActualValue: clc.redBright,
    failureStack: clc.blackBright
  }
};

styles = styles[require('../../utils').getTartareOptions('theme') || 'dark'];

if (!GherkinBase.Base.useColors) {
  _.map(styles, function(value, key) {
    styles[key] = function(str) { return str };
  });
}


/**
 * Mocha reporter that outputs coloured Gherkin syntax using stdout/stderr
 */

function GherkinReporter(runner) {
  GherkinBase.call(this, runner);

  var self = this;
  var indents = 0;

  function indent(str, tabNumber, mustTrim) {
    tabNumber = tabNumber || indents - 1;
    return str.split(os.EOL).map(function(line) {
      return new Array(tabNumber + 1).join('  ') + (mustTrim ? line.trim() : line);
    }).join(os.EOL);
  }

  function pad(str, len, paddingStr) {
    var padding = new Array(len).join(paddingStr || ' ');
    return String(padding + str).slice(-padding.length);
  }

  function format(obj, style) {
    if (obj === null) {
      return style.italic('null');
    }
    if (obj === undefined) {
      return style.italic('undefined');
    }
    if (obj instanceof RegExp) {
      return style(obj.toString());
    }
    if (obj instanceof Buffer) {
      return style(obj.toString());
    }
    if (typeof obj === 'string') {
      return style(obj);
    }
    return style(JSON.stringify(obj, null, 2));
  }

  function printFailures(failures) {
    console.error();
    failures.forEach(function(test, i){
      // msg
      var err = test.err
        , message = err.message || ''
        , stack = err.stack || message
        , index = stack.indexOf(message) + message.length
        , actual = err.actual
        , expected = err.expected
        , name = err.name;

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
      console.error(styles.failureText((i + 1) + ') ' + titles.join(' --> ')));
      console.error();

      // print message Error
      console.error(styles.failureMessage(indent(err.name + ': ' + message, 1)));
      if (err.name === 'AssertionError') {
        // print Expected vs Actual in case of Assertion Error
        console.error(os.EOL + indent(styles.failureExpected('Expected:'), 2) + os.EOL + os.EOL
          + indent(format(expected, styles.failureExpectedValue), 3)
        );
        console.error(os.EOL + indent(styles.failureActual('Actual:'), 2) + os.EOL + os.EOL
          + indent(format(actual, styles.failureActualValue), 3)
        );
      }

      //print stack trace
      console.error(os.EOL + styles.failureStack(indent(stack, 2, true)) + os.EOL + os.EOL);
    });
  }


  runner.on('start', function() {
    console.log();
  });

  runner.on('feature', function(feature) {
    ++indents;
    console.log(indent((feature.pending ? styles.featureTitlePending : styles.featureTitle)(feature.title) + os.EOL));
    feature.subtitle.forEach(function(subtitleLine) {
      console.log(indent('\t' + (feature.pending ? styles.featureSubtitlePending : styles.featureSubtitle)(subtitleLine)));
    });
    if (!feature.pending) {
      if (feature.subtitle.length) {
        console.log();
      }
      console.log();
    }
  });

  runner.on('scenario', function(scenario) {
    ++indents;
    if (!scenario.parent.pending) {
      console.log(indent((scenario.pending ? styles.scenarioPending : styles.scenario)(scenario.title)));
    }
  });

  runner.on('variant', function(variant) {
    ++indents;
    if (!variant.parent.pending && !variant.dummy) {
      console.log(indent((variant.pending ? styles.variantPending : styles.variant)(variant.title)));
    }
  });

  runner.on('describe', function(suite) {
    ++indents;
    // 'Spec reporter'-like output
    console.log(GherkinBase.Base.color('suite', '%s'), indent(suite.title));
  });

  runner.on('feature end', function(feature) {
    --indents;
    console.log();
  });

  runner.on('scenario end', function(scenario) {
    --indents;
    if (!scenario.parent.pending) {
      console.log();
    }
  });

  runner.on('variant end', function(variant) {
    --indents;
    // Blank line after a Variant which is not the last Variant of an Scenario
    if (!variant.parent.pending && variant.parent.suites.slice(-1) !== variant) {
      console.log();
    }
  });

  runner.on('describe end', function(suite) {
    // Blank line for first-level suites
    if (1 == indents) {
      console.log();
    }
    --indents;
  });

  runner.on('step pending', function(step) {
    if (!step.parent.pending) {
      var pos = step.title.indexOf(': ');
      console.log(indent(
        styles.symbolPending('  ◊ ') +
        styles.stepLabelPending(pad(step.title.substring(0, pos), 6) + ': ') +
        styles.stepTextPending(step.title.substring(pos + 2))));
    }
  });

  runner.on('it pending', function(test) {
    // 'Spec reporter'-like output
    var fmt = indent(GherkinBase.Base.color('pending', '  - %s'));
    console.log(fmt, test.title);
  });

  runner.on('step', function(step) {
    var pos = step.title.indexOf(': ');
    process.stdout.write(indent(
      styles.symbol('  ◦ ') +
      styles.stepLabel(pad(step.title.substring(0, pos), 6) + ': ') +
      styles.stepText(step.title.substring(pos + 2))));
  });

  runner.on('it', function(test) {
    // 'Spec reporter'-like output
    process.stdout.write(indent(GherkinBase.Base.color('pass', '  ◦ ' + test.title + ': ')));
  });

  runner.on('step pass', function(step) {
    var pos = step.title.indexOf(': ');
    GherkinBase.Base.cursor.CR();
    console.log(indent(
      styles.symbol('  ' + GherkinBase.Base.symbols.ok + ' ') +
      styles.stepLabel(pad(step.title.substring(0, pos), 6) + ': ') +
      styles.stepText(step.title.substring(pos + 2)) +
      styles.duration(' (' + step.duration + 'ms)')));
  });

  runner.on('it pass', function(test) {
    // 'Spec reporter'-like output
    var fmt = indent(
      GherkinBase.Base.color('checkmark', '  ' + GherkinBase.Base.symbols.ok) +
      GherkinBase.Base.color('pass', ' %s ')
    );
    if ('fast' == test.speed) {
      GherkinBase.Base.cursor.CR();
      console.log(fmt, test.title);
    }
    else {
      fmt += GherkinBase.Base.color(test.speed, '(%dms)');
      GherkinBase.Base.cursor.CR();
      console.log(fmt, test.title, test.duration);
    }
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

  runner.on('it fail', function(test, err) {
    // 'Spec reporter'-like output
    GherkinBase.Base.cursor.CR();
    console.log(indent(GherkinBase.Base.color('fail', '  ' + GherkinBase.Base.symbols.err + ' %d) %s'), self.failures.length, test.title));
  });

  runner.on('end', function() {
    console.log();

    // REPORT
    console.log(pad('', 13) + '| ' + styles.symbol('passed') + ' | ' + styles.symbolFailed('failed') + ' | ' +
      styles.symbolPending('pending') + ' | TOTAL |');
    console.log('  ' + pad('', 48, '-'));
    _.each(self.stats, function(value, key) {
      console.log('  ' + pad(key[0].toUpperCase() + key.slice(1), 10) + ' | ' +
        styles.symbol(pad(value.passed, 7)) + ' | ' +
        styles.symbolFailed(pad(value.failed, 7)) + ' | ' +
        styles.symbolPending(pad(value.pending, 8)) + ' | ' +
        pad(value.passed + value.failed + value.pending, 6) + ' |');
    });
    console.log();

    // METRICS
    var str;
    console.log();
    console.log('  METRICS:');
    str = '   · Product size (Σ features): ' + (self.stats.features.passed + self.stats.features.failed);
    if (self.stats.features.pending) {
      str += ' (+' + self.stats.features.pending + ' pending)';
    }
    console.log(str);
    str = '   · Test-set size (Σ test-variants): ' + (self.stats.variants.passed + self.stats.variants.failed);
    if (self.stats.variants.pending) {
      str += ' (+' + self.stats.variants.pending + ' pending)';
    }
    console.log(str);
    str = '   · Coverage (Σ test-variants/feature): [';
    if (_.size(self.variantsPerFeature)) {
      _.each(self.variantsPerFeature, function(value, key) {
        str += value.ok;
        if (value.pending) {
          str += ' (+' + value.pending + ' pending)';
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

    // FAILURES DETAIL
    if (self.failures.length) {
      console.log();
      console.log('  FAILURES:');
      printFailures(self.failures);
      console.log();
    }

    process.exit(self.failures.length);
  });

}
util.inherits(GherkinReporter, GherkinBase);


module.exports = GherkinReporter;
