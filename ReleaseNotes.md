# RELEASE NOTES

## v0.6.0 / XXX

### API Mock

* Mock responses may include references to request body fields when the body can be parsed as JSON or XML. 
  XML bodies are converted to JSON using [xml2json](https://www.npmjs.org/package/xml2json).
  If the body can be parsed, it will be accessible through a `bodyJson` property.
 
```json
{
  "method": "POST",
  "path": "/",
  "response": {
    "statusCode": 200,
    "body": "Result: {{{bodyJson.fieldName}}}"
  }
}
```


## v0.5.0 / 3 Oct 2014

### Gherkin framework and reporter

* From now on, Tartare can be invoked as a CLI program, instead of passing in a Tartare reporter to Mocha.
  Enter `tartare -h` in a console to see available options.
* A  new **tagging and filtering** functionality has been added to Tartare, so features, scenarios and variants can be tagged
  and then those tags can be used to filter test execution by using the `--filter` option.
    - Tag features and scenarios by calling the `tag` method after its definition: `scenario('myscenario', function() { }).tag('mytag');`
    - Tag variants by adding a `tag` property to the dataset object: `dataset = { desc: 'my 1st variant', tag: 'mytag', ... };`
    - See `tartare -h` for more info about filtering.
* To use Tartare and the filtering functionality with [Protractor](http://angular.github.io/protractor), use a `mochaOpts` object
  such as the following in your `conf.js` file:
  
```javascript
    mochaOpts: { 
      reporter: ('tartare/gherkin'), 
      grep: 'tartare: +mytag'  // Note that the filter string must be prefixed by 'tartare: '
    }
```

* New modifiers have been added to Tartare's keywords (feature, scenario, given, when, and, then) that change their behaviour.
  The full set of modifiers is the following:
    - `.only`: Restrict the execution to only those features/scenarios having this modifier. 
    - `.skip`: Make this feature/scenario/step as nonexistent, nor being shown on reports or counted on stats.
    - `.manual`: Mark this feature/scenario/step as manual, meaning that the test execution is out of Tartare's scope. 
      They will be shown with a different style in the report.
      Using this modifier is equivalent to not providing a function when defining the feature/scenario/step.
    - `.manual.skip`: The same than `.skip` for manual features/scenarios/steps.

    Variants can also use those modifiers by adding a field with the modifier name and a truthy value to the variant objects in the dataset array.

    Manual features/scenarios/steps will be assigned with a tag named 'manual' so you use it to filter tests execution.

```javascript
    scenario.manual('This is a manual scenario', function() {
    
    });
  
    dataset = [
      { manual: true, desc: 'This is a manual variant' } 
    ];
```
     
 * A couple of new methods have been added to features/scenarios in order to make easier bug monitoring:
     - `.minorBug(bugId)`: Used for features/scenarios that are somehow buggy but you don't want the report to shown them as buggy.
        This method prevents the feature/scenario from being executed (to avoid triggering the bug) and will show the bug id next to the title.
        They count as passed in stats.
     - `.majorBug(bugId)`: Used for marking features/scenarios as buggy. They are executed showing the bug id next to the title, and are counted as failed in stats. 
      
   Variants can also use these features by adding a field with the method name and the bug id as value to the variant objects in the dataset array. 
   
   If you provide a parameter named `--bugid-link` to Tartare command line, bug ids will be shown as links using that parameter value 
   as a template where the string '%s' will be replaced by the bug id. This can be useful to link with some bug tracking system. If no
   '%s' placeholder is provided, the bug id will be added to the end of the provided link.
   
   Both methods set a tag named 'bug' so you use it to filter tests execution.
      
```javascript
    scenario('This is a buggy scenario', function() {
    
    }).majorBug('my-bug-id');
  
    dataset = [
      { minorBug: 'my-bug-id', desc: 'This is a variant with a minor bug' } 
    ];
```
      
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
* Fixed a bug that prevented `collections` module from preserving the HTTP headers name casing.
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
