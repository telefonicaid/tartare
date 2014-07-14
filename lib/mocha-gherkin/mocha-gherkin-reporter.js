'use strict';

var _ = require('underscore');

var LABELS = require('./common').LABELS;


/**
 * Mocha reporter that outputs coloured Gherkin syntax
 * and calculates real metrics based on Features, Scenarios and Variants
 */

var clc = require('cli-color');
var Base = require('mocha/lib/reporters/base');

function GherkinReporter(runner) {
  Base.call(this, runner);

  var indents = 0
    , failuresCounter = 0
    , failures = [];

  var stats = {
    features: { passed: 0, pending: 0, failed: 0},
    scenarios: { passed: 0, pending: 0, failed: 0},
    variants: { passed: 0, pending: 0, failed: 0},
    steps: { passed: 0, pending: 0, failed: 0}
  };
  var variantsPerFeature = {};

  var styles = {
    featureTitle: clc.green.bold.underline,
    featureTitlePending: clc.green.bold.strike,
    featureStory: clc.white,
    featureStoryPending: clc.white.strike,
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
    duration: clc.magenta.italic.bold,
    symbol: clc.green,
    symbolPending: clc.blackBright,
    symbolFailed: clc.red,
    failureTest: clc.white.bold,
    failureMessage: clc.red,
    failureExpected: clc.bgGreenBright,
    failureExpectedValue: clc.greenBright,
    failureActual: clc.bgRedBright,
    failureActualValue: clc.redBright,
    failureStack: clc.blackBright
  };

  if (!Base.useColors) {
    _.map(styles, function(value, key) {
      styles[key] = function(str) { return str };
    });
  }

  function indent() {
    return new Array(indents).join('  ');
  }

  function pad(str, len, paddingStr) {
    var padding = new Array(len).join(paddingStr || ' ');
    return String(padding + str).slice(-padding.length);
  }

  function isStep(title) {
    return (title.startsWith(LABELS.given) ||
            title.startsWith(LABELS.when) ||
            title.startsWith(LABELS.then) ||
            title.startsWith(LABELS.and));
  }

  function isPending(suite) {
    if (suite.pending) {
      return true;
    }
    var children = (suite.type === 'variant' ? suite.tests : suite.suites);
    var _isPending = children.map(function(child) {
      return child.pending;
    }).reduce(function(previous, value) {
      return (suite.type === 'variant' ? previous || value : previous && value);
    });
    if (_isPending) {
      suite.pending = true;
    }
    return _isPending;
  }

  function hasPassed(suite) {
    var children = (suite.type === 'variant' ? suite.tests : suite.suites);
    var _hasPassed = children.map(function(child) {
      return (suite.type === 'variant' ? child.state === 'passed' : child.pending || child.state === 'passed');
    }).reduce(function(previous, value) {
      return previous && value;
    });
    if (_hasPassed) {
      suite.state = 'passed';
    }
    return _hasPassed;
  }

  function hasFailed(suite) {
    var children = (suite.type === 'variant' ? suite.tests : suite.suites);
    var _hasFailed = children.map(function(child) {
      return (child.state === 'failed');
    }).reduce(function(previous, value) {
      return previous || value;
    });
    if (_hasFailed) {
      suite.state = 'failed';
    }
    return _hasFailed;
  }

  function formatValue(obj, isExpected) {
    var style = isExpected ? styles.failureExpectedValue : styles.failureActualValue;
    if (obj === null) {
      return style.italic('null');
    }
    if (obj === undefined)
    {
      return style.italic('undefined');
    }
    if (obj instanceof RegExp) {
      return style(obj.toString());
    }
    if (obj instanceof Buffer) {
      return style(obj.toString());
    }
    return style(JSON.stringify(obj, null, 2));
  }

  function tabValue(obj, tabNumber, mustTrim) {
    tabNumber = tabNumber || 1;
    return obj.split('\n').map(function(line){
      return new Array(tabNumber + 1).join('  ') + (mustTrim ? line.trim() : line);
    }).join('\n');
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

      // print test info splitting full title info
      var pattern = /^(Feature: .*) (Scenario: .*) (Variant(?: #\d+)?(?:: .*)?) ((?:(?:Given|When|Then|And): .*)|(?:\"after all\" hook)|(?:\"before all\" hook))$/;
      var fields = test.fullTitle().match(pattern);
      if (fields) {
        fields = fields.slice(1);
        console.error(styles.failureTest((i+1) + ') ' + fields.join(' --> ')));
      } else {
        console.error(styles.failureTest((i+1) + ') ' + test.fullTitle()));
      }
      console.error();

      // print message Error
      console.error(styles.failureMessage(tabValue(err.name + ': ' + message, 1)));
      if (err.name === 'AssertionError') {
        //print Expected vs. Actual in case of Assertion Error
        console.error('\n    ' + styles.failureExpected('Expected:') + '\n\n'
          + tabValue(formatValue(expected, true), 3));
        console.error('\n    ' + styles.failureActual('Actual:') + '\n\n'
          + tabValue(formatValue(actual, false), 3));
      }

      //print stack trace
      console.error('\n' + styles.failureStack(tabValue(stack, 2, true)) + '\n\n');

    });

  }

  runner.on('start', function(){
    console.log();
  });

  runner.on('suite', function(suite){
    ++indents;

    // It's a Feature
    if (suite.title.startsWith(LABELS.feature)) {
      suite.type = 'feature';
      var lines = suite.title.split('\n');
      console.log(indent() + (suite.pending ? styles.featureTitlePending : styles.featureTitle)(lines[0]) + '\n');
      lines.slice(1).forEach(function(storyLine) {
        console.log(indent() + '\t' + (suite.pending ? styles.featureStoryPending : styles.featureStory)(storyLine));
      });
      if (!suite.pending) {
        console.log();
        console.log();
      }
    }
    // It's an Scenario
    else if (suite.title.startsWith(LABELS.scenario)) {
      suite.type = 'scenario';
      if (!suite.parent.pending) {
        console.log(indent() + (suite.pending ? styles.scenarioPending : styles.scenario)(suite.title));
      }

    }
    // It's a Variant
    else if (suite.title.startsWith(LABELS.variant)) {
      suite.type = 'variant';
      if (!suite.parent.pending && suite.title.startsWith(LABELS.variant + ' #')) {
        console.log(indent() + (suite.pending ? styles.variantPending : styles.variant)(suite.title));
      }
    }
    // 'Spec reporter'-like output
    else {
      console.log(Base.color('suite', '%s%s'), indent(), suite.title);
    }
  });

  runner.on('suite end', function(suite){
    --indents;

    if (suite.type) {
      if (suite.type === 'variant' &&
          suite.parent.suites[suite.parent.suites.length - 1].title !== suite.title &&
          !suite.parent.pending) {
        // Blank line after a Variant which is not the last Variant of an Scenario
        console.log();
      }
      else if (suite.type === 'scenario' && !suite.parent.pending) {
        console.log();
      }

      // Stats
      if (isPending(suite)) {
        stats[suite.type + 's'].pending++;
      }
      else if (hasPassed(suite)) {
        stats[suite.type + 's'].passed++;
      }
      else if (hasFailed(suite)) {
        stats[suite.type + 's'].failed++;
      }

      // Variants per feature (for metrics)
      if (suite.type === 'variant') {
        var parentFeature = suite.parent.parent.title;
        variantsPerFeature[parentFeature] = variantsPerFeature[parentFeature] || { ok: 0, pending: 0 };
        if (isPending(suite)) {
          variantsPerFeature[parentFeature].pending++;
        }
        else {
          variantsPerFeature[parentFeature].ok++;
        }
      }
    }

    // Blank line for first-level suites
    if (1 == indents) {
      console.log();
    }
  });

  runner.on('pending', function(test){
    if (isStep(test.title)) {
      stats.steps.pending++;

      if (!test.parent.pending) {
        var pos = test.title.indexOf(': ');
        console.log(indent() +
                    styles.symbolPending('  ◊ ') +
                    styles.stepLabelPending(pad(test.title.substring(0, pos), 6) + ': ') +
                    styles.stepTextPending(test.title.substring(pos + 2)));
      }
    }
    else if (test.parent.type === 'scenario') {
      // Do nothing: It's a dummy 'it' whose parent is a pending scenario without function
    }
    else {
      // 'Spec reporter'-like output
      var fmt = indent() + Base.color('pending', '  - %s');
      console.log(fmt, test.title);
    }
  });

  runner.on('test', function(test){
    if (isStep(test.title)) {
      var pos = test.title.indexOf(': ');
      process.stdout.write(indent() +
        styles.symbol('  ◦ ') +
        styles.stepLabel(pad(test.title.substring(0, pos), 6) + ': ') +
        styles.stepText(test.title.substring(pos + 2)));
    }
    else {
      // 'Spec reporter'-like output
      process.stdout.write(indent() + Base.color('pass', '  ◦ ' + test.title + ': '));
    }
  });

  runner.on('pass', function(test){
    if (isStep(test.title)) {
      stats.steps.passed++;

      var pos = test.title.indexOf(': ');
      Base.cursor.CR();
      console.log(indent() +
        styles.symbol('  ' + Base.symbols.ok + ' ') +
        styles.stepLabel(pad(test.title.substring(0, pos), 6) + ': ') +
        styles.stepText(test.title.substring(pos + 2)) +
        styles.duration(' (' + test.duration + 'ms)'));
    }
    else {
      // 'Spec reporter'-like output
      var fmt = indent()
        + Base.color('checkmark', '  ' + Base.symbols.ok)
        + Base.color('pass', ' %s ');
      if ('fast' == test.speed) {
        Base.cursor.CR();
        console.log(fmt, test.title);
      }
      else {
        fmt += Base.color(test.speed, '(%dms)');
        Base.cursor.CR();
        console.log(fmt, test.title, test.duration);
      }
    }
  });

  runner.on('fail', function(test, err){
    if (isStep(test.title)) {
      stats.steps.failed++;

      var pos = test.title.indexOf(': ');
      Base.cursor.CR();
      console.log(indent() +
        styles.symbolFailed('  ' + Base.symbols.err + ' ' + ++failuresCounter + ') ') +
        styles.stepLabelFailed(test.title.substring(0, pos) + ': ') +
        styles.stepTextFailed(test.title.substring(pos + 2)));
    }
    else {
      // 'Spec reporter'-like output
      Base.cursor.CR();
      console.log(indent() + Base.color('fail', '  ' + Base.symbols.err + ' %d) %s'), ++failuresCounter, test.title);
    }

    failures.push(test);
  });

  runner.on('test end', function(test){

  });

  runner.on('end', function(){
    console.log();

    // REPORT
    console.log(pad('', 13) + '| ' + styles.symbol('passed') + ' | ' + styles.symbolFailed('failed') + ' | ' +
                styles.symbolPending('pending') + ' | TOTAL |');
    console.log('  ' + pad('', 48, '-'));
    _.each(stats, function(value, key) {
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
    str = '   · Product size (Σ features): ' + (stats.features.passed + stats.features.failed);
    if (stats.features.pending) {
      str += ' (+' + stats.features.pending + ' pending)';
    }
    console.log(str);
    str = '   · Test-set size (Σ test-variants): ' + (stats.variants.passed + stats.variants.failed);
    if (stats.variants.pending) {
      str += ' (+' + stats.variants.pending + ' pending)';
    }
    console.log(str);
    str = '   · Coverage (Σ test-variants/feature): [';
    if (_.size(variantsPerFeature)) {
      _.each(variantsPerFeature, function(value, key) {
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

    if (failuresCounter) {
      // FAILURES DETAIL
      console.log();
      console.log('  FAILURES:');

      printFailures(failures);

      console.log();
    }

    process.exit(failuresCounter);
  });
}

// Inherit from `Base.prototype`.
GherkinReporter.prototype.__proto__ = Base.prototype;


module.exports.GherkinReporter = GherkinReporter;
