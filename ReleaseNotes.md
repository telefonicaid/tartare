# RELEASE NOTES

## v0.4.0 / 7 Aug 2014

### Gherkin framework and reporter

* A new Gherkin reporter has been added that outputs Markdown format. Useful to upload the test report to Github.
* The console Gherkin reporter now supports color schemes for dark and clear backgrounds.
  Set an environment variable `TARTARE_THEME` to `dark` or `clear`.
* Features having the same title are considered the same feature when computing stats.
  Moreover the Markdown Gherkin reporter merges all scenarios whose feature share the same title.
* Better support for features and steps without implementation (that is, without a callback function),
  including a better integration with [selenium-webdriver](https://www.npmjs.org/package/selenium-webdriver).

### HTTP helpers and chai plugins
* Fixed a bug that prevented collections module from preserving the HTTP headers name casing.
* Fixed a bug that made `httpAllowHeader` assertion to fail in some corner cases.


## v0.3.1 / 23 Jul 2014

### Gherkin framework and reporter

A workaround has been added to Tartare in order to support [selenium-webdriver](https://www.npmjs.org/package/selenium-webdriver)
(or other frameworks using selenium-webdriver) that is not returning the created test when calling the Mocha's `it` function.


## v0.3.0 / 22 Jul 2014

### Gherkin framework and reporter

New before/after hooks have been added: beforeAll, afterAll, beforeScenario, afterScenario, beforeEachScenario, afterEachScenario.

Moreover, the usage of hook's keywords is checked to avoid using them in a wrong place.

The full list of available hooks and the allowed usage is as follows:

| Hook name                            | Usage                                 |
|--------------------------------------|---------------------------------------|
| beforeAll/afterAll                   | Top level (outside Features)          |
| beforeFeature/afterFeature           | Inside Features and outside Scenarios |
| beforeEachScenario/afterEachScenario | Inside Features and outside Scenarios |
| beforeScenario                       | Inside Scenarios                      |
| beforeEachVariant/afterEachVariant   | Inside Scenarios                      |


Some issues have been fixed in the Gherkin reporter:

* When several features had the same title, they were counted as distinct features in the stats table shown at the end of the report. Now features with the same name are considered as the same feature.
* When an error occurs inside a hook, the type of hook is shown, together with the full path (Feature --> Scenario --> Variant --> beforeEachVariant).
* Failures' actual and expected values are now correctly printed when they are strings.


### API Mock

* Mock's last requests now include the remote client address (ip and port).
* A bug that prevented mocks from remembering more than one 'last request' has been fixed.


### Other

* Fixed a bug that made `startServer` function to fail when `startupMessages` parameter is an empty array.
* `synchronize` function now allows to synchronize nested functions in modules.
