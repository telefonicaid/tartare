<a name="1.1.0"></a>
# [1.1.0](https://github.com/telefonicaid/tartare/compare/v1.0.3...v1.1.0) (2016-09-19)


### Bug Fixes

* `this` is not working on steps when the function is wrapped into a promise ([d722313](https://github.com/telefonicaid/tartare/commit/d722313))

### Features

* Add declarations to use Tartare with TypeScript ([ca80350](https://github.com/telefonicaid/tartare/commit/ca80350))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/telefonicaid/tartare/compare/v1.0.2...v1.0.3) (2016-09-09)


### Bug Fixes

* When steps or hooks return promises, Tartare is not waiting for them to be resolved ([ab400a3](https://github.com/telefonicaid/tartare/commit/ab400a3))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/telefonicaid/tartare/compare/v1.0.1...v1.0.2) (2016-07-13)


### Bug Fixes

* Some hooks throw error when used with protractor-tartare (Fixes #35) ([d605df2](https://github.com/telefonicaid/tartare/commit/d605df2)), closes [#35](https://github.com/telefonicaid/tartare/issues/35)



<a name="1.0.1"></a>
## [1.0.1](https://github.com/telefonicaid/tartare/compare/v1.0.0...v1.0.1) (2016-07-08)


### Bug Fixes

* Hooks belonging to features, scenarios or variants marked as minorBug are sometimes executed (Fixes #34) ([f334806](https://github.com/telefonicaid/tartare/commit/f334806)), closes [#34](https://github.com/telefonicaid/tartare/issues/34)



<a name="1.0.0"></a>
# [1.0.0](https://github.com/telefonicaid/tartare/compare/v0.9.0...v1.0.0) (2016-05-05)


### Features

* Add a new `interactive` option to allow disabling interactive features ([e2b58f5](https://github.com/telefonicaid/tartare/commit/e2b58f5))
* Allow setting Tartare options through env vars. ([015c658](https://github.com/telefonicaid/tartare/commit/015c658))
* Support reporter-specific parameters for the gherkin-md reporter (output and bugidLink) ([8eea5b9](https://github.com/telefonicaid/tartare/commit/8eea5b9))



