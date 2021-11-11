# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]
### Added
* Add glossary support for document translation. 
* Add missing argument validation for: formality, split_sentences, preserve_formatting and outline_detection.
* Add an optional proxy server that proxies requests to the mock server, listening on port 3001 by
  default.
* Add `expect-proxy` session variable to reject requests not via proxy, as determined by presence of
  the `Forwarded` header.
### Changed
* Require a non-empty User-Agent header for all endpoints.
### Deprecated
### Removed
### Fixed
### Security


## [1.2.0] - 2021-10-06
### Added
* Add support for /v2/glossary-languages-pair endpoint.
### Fixed
* Document status seconds_remaining field is an integer.
* Glossary info source and target languages are lowercase.


## [1.1.0] - 2021-09-13
### Added
* Add support for glossary API functions.
### Fixed
* Accept both query and body parameters for all HTTP methods.
* Refactor internal date usage to use Date objects.


## [1.0.1] - 2021-08-12
### Added
* Add explicit copyright notice to all source files.


## [1.0.0] - 2021-08-12
### Added
* Add support for Authorization header with "DeepL-Auth-Key " prefix. 
### Fixed
* Fix bug in error responses introduced in eslint refactoring.


## [0.2.0] - 2021-08-03
### Added
* Use eslint and airbnb style for code checking.
### Fixed
* Fix issue when no array parameters are specified.


## [0.1.0] - 2021-07-30
Initial version.


[Unreleased]: https://github.com/DeepLcom/deepl-mock/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/DeepLcom/deepl-mock/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/DeepLcom/deepl-mock/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/DeepLcom/deepl-mock/releases/tag/v0.1.0
