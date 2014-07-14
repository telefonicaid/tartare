'use strict';

/**
 * Mocha reporter that outputs coloured Gherkin syntax
 * and calculates real metrics based on Features, Scenarios and Variants
 */

module.exports = require('./lib/mocha-gherkin/mocha-gherkin-reporter').GherkinReporter;
