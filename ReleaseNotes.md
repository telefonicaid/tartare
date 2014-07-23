# RELEASE NOTES


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
