# RELEASE NOTES

## v1.1.3 / 3 Oct 2016
* Fixed TypeScript declarations to support the variant argument in scenario's spec functions.

## v1.1.2 / 27 Sep 2016
* Improved TypeScript declarations.

## v1.1.1 / 19 Sep 2016
* Fixed typings installation location in documentation.

## v1.1.0 / 19 Sep 2016
* Added declarations to use Tartare with TypeScript.
* Fixed a bug that prevented `this` from working on steps when the function is wrapped into a promise.

## v1.0.3 / 9 Sep 2016
* Fixed a bug that prevented Tartare from waiting for promises to be resolved when steps or hooks return promises.

## v1.0.2 / 13 Jul 2016
* Fixed a bug that caused hooks to throw errors when running with `protractor-tartare`.

## v1.0.1 / 8 Jul 2016
* Fixed a bug that allowed hooks to be executed in features, scenarios and variants marked as minor bugs.

## v1.0.0 / 5 May 2016
* Added documentation about how to use Tartare with the new `protractor-tartare` package, which allows you to use
  Tartare along with Protractor (the [Protractor fork](https://github.com/telefonicaid/protractor/tree/tartare)
  won't be used anymore).
* Every option that can be passed to the Tartare constructor can also be set using environment variables.
* A new `interactive` option has been added to prevent reporters from using the console in a way that may break
  some console emulators.
* The gherkin-md reporter supports reporter-specific options to set the output file and the `bugidLink` parameter.

## v0.9.0 / 8 Jun 2015
* Added full documentation on the README file.

## v0.8.0 / 13 Feb 2015
* Fixed gherkin-md reporter to finish without calling `process.exit`.
* Added execution time for variants, scenarios, features and for the whole suite in the `gherkin` reporter.
* Added a new `sleep` function that works like `setTimeout` but expect the `cb` in the last argument and
  it is ready to be used as a synchronous function.

## v0.7.0 / 11 Jan 2015
* From now on, `tartare` package contains only the framework functionality, while the rest of goodies are spread among
  the new packages `tartare-util`, `tartare-collections`, `tartare-mock`, `tartare-chai` and `tartare-logs`.
* Tartare is now fully compatible with [Protractor](http://angular.github.io/protractor). Until the `tartare` branch
  in the `telefonicaid` fork is merged into Protractor upstream, get Protractor from
  [here](https://github.com/telefonicaid/protractor/tree/tartare).
  - There is a new global function called `promisize` that wraps all functions exported by a module to convert them
    into WebDriver promises, and enqueue them in the WebDriver Control Flow, so they can be used in the same way
    that Protractor's functions (`browser`, `element`, etc.) are used.
* From now on, Tartare can be used programmatically, instantiating a Tartare object, and gaining control over the
  tests execution.
  You can pass an object to the Tartare constructor with the following options:
  - `reporter`: Choose between the console reporter (`gherkin`) or the markdown reporter (`gherkin-md`).
    Default: `gherkin`.
  - `timeout`: Set test timeout in milliseconds. Default: `10000`.
  - `filter`: Run only tests matching the filter.
  - `bail`: Stop executing tests on the first failure: Default: `true`.
  - `useColors`: Set whether colors can be used on console reporters. Default: `true`.
  - `enableTimeouts`: Enable timeouts. Default: `true`.
  - Any other options will be available through the `getTartareOptions` function.

  You can access to the underlying Mocha object through `tartare.mocha`.


```javascript
var Tartare = require('tartare');

// First, instantiate a Tartare instance.
var tartare = new Tartare({
  timeout: 5000,
  filter: 'some_tag'
});

// Then, add the test files using the "addFiles" method.
tartare.addFiles([file1, file2, ...]);

// Finally, run the tests!
tartare.run(function(failures) {
  process.exit(failures);
});
```

* The CLI program now supports new arguments. See `tartare -h` for more info.
* A new `but` step has been added.
* Test execution stops after the first failure as a default behaviour that can be changed passing `bail: false` to the
  Tartare constructor, or `--no-bail` to the CLI program.
* `getTartareOptions` and `synchronize` are now global functions, so you can call them without the `tartare.` prefix.

## v0.6.0 / 6 Nov 2014
* Fix some styles on the Gherkin reporter.

## v0.5.0 / 3 Oct 2014
* From now on, Tartare can be invoked as a CLI program, instead of passing in a Tartare reporter to Mocha.
  Enter `tartare -h` in a console to see available options.
* A  new **tagging and filtering** functionality has been added to Tartare, so features, scenarios and variants
  can be tagged and then those tags can be used to filter test execution by using the `--filter` option.
    - Tag features and scenarios by calling the `tag` method after its definition:
      `scenario('myscenario', function() { }).tag('mytag');`
    - Tag variants by adding a `tag` property to the dataset object:
      `dataset = { desc: 'my 1st variant', tag: 'mytag', ... };`
    - See `tartare -h` for more info about filtering.
* To use Tartare and the filtering functionality with [Protractor](http://angular.github.io/protractor),
  use a `mochaOpts` object such as the following in your `conf.js` file:

```javascript
    mochaOpts: {
      reporter: ('tartare/gherkin'),
      grep: 'tartare: +mytag'  // Note that the filter string must be prefixed by 'tartare: '
    }
```

* New modifiers have been added to Tartare's keywords (feature, scenario, given, when, and, then)
  that change their behaviour.
  The full set of modifiers is the following:
    - `.only`: Restrict the execution to only those features/scenarios having this modifier.
    - `.skip`: Make this feature/scenario/step as nonexistent, nor being shown on reports or counted on stats.
    - `.manual`: Mark this feature/scenario/step as manual, meaning that the test execution is out of Tartare's scope.
      They will be shown with a different style in the report.
      Using this modifier is equivalent to not providing a function when defining the feature/scenario/step.
    - `.manual.skip`: The same than `.skip` for manual features/scenarios/steps.

  Variants can also use those modifiers by adding a field with the modifier name and a truthy value
  to the variant objects in the dataset array.

  Manual features/scenarios/steps will be assigned with a tag named 'manual' so you use it to filter tests execution.

```javascript
    scenario.manual('This is a manual scenario', function() {

    });

    dataset = [
      { manual: true, desc: 'This is a manual variant' }
    ];
```

 * A couple of new methods have been added to features/scenarios in order to make easier bug monitoring:
     - `.minorBug(bugId)`: Used for features/scenarios that are somehow buggy but you don't want the report
       to shown them as buggy. This method prevents the feature/scenario from being executed
       (to avoid triggering the bug) and will show the bug id next to the title. They count as passed in stats.
     - `.majorBug(bugId)`: Used for marking features/scenarios as buggy. They are executed showing the bug id next
       to the title, and are counted as failed in stats.

   Variants can also use these features by adding a field with the method name and the bug id as value
   to the variant objects in the dataset array.

   If you provide a parameter named `--bugid-link` to Tartare command line, bug ids will be shown as links using
   that parameter value as a template where the string '%s' will be replaced by the bug id. This can be useful
   to link with some bug tracking system. If no '%s' placeholder is provided, the bug id will be added to the end
   of the provided link.

   Both methods set a tag named 'bug' so you use it to filter tests execution.

```javascript
    scenario('This is a buggy scenario', function() {

    }).majorBug('my-bug-id');

    dataset = [
      { minorBug: 'my-bug-id', desc: 'This is a variant with a minor bug' }
    ];
```

## v0.4.0 / 7 Aug 2014
* A new Gherkin reporter has been added that outputs Markdown format. Useful to upload the test report to Github.
* The console Gherkin reporter now supports color schemes for dark and clear backgrounds.
  Set an environment variable `TARTARE_THEME` to `dark` or `clear`.
* Features having the same title are considered the same feature when computing stats.
  Moreover the Markdown Gherkin reporter merges all scenarios whose feature share the same title.
* Better support for features and steps without implementation (that is, without a callback function),
  including a better integration with [selenium-webdriver](https://www.npmjs.org/package/selenium-webdriver).

## v0.3.1 / 23 Jul 2014
* A workaround has been added to Tartare in order to support
  [selenium-webdriver](https://www.npmjs.org/package/selenium-webdriver) (or other frameworks using selenium-webdriver)
  that is not returning the created test when calling the Mocha's `it` function.

## v0.3.0 / 22 Jul 2014
* New before/after hooks have been added: beforeAll, afterAll, beforeScenario, afterScenario, beforeEachScenario,
  afterEachScenario.

  Moreover, the usage of hook's keywords is checked to avoid using them in a wrong place.

  The full list of available hooks and the allowed usage is as follows:

| Hook name                            | Usage                                 |
|--------------------------------------|---------------------------------------|
| beforeAll/afterAll                   | Top level (outside Features)          |
| beforeFeature/afterFeature           | Inside Features and outside Scenarios |
| beforeEachScenario/afterEachScenario | Inside Features and outside Scenarios |
| beforeScenario                       | Inside Scenarios                      |
| beforeEachVariant/afterEachVariant   | Inside Scenarios                      |


* Some issues have been fixed in the Gherkin reporter:
  - When several features had the same title, they were counted as distinct features in the stats table shown
    at the end of the report. Now features with the same name are considered as the same feature.
  - When an error occurs inside a hook, the type of hook is shown, together with the full path
    (Feature --> Scenario --> Variant --> beforeEachVariant).
  - Failures' actual and expected values are now correctly printed when they are strings.

* `synchronize` function now allows to synchronize nested functions in modules.
