# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]
### Changed
* Update contributing guidelines, we can now accept Pull Requests.


## [1.5.0] - 2022-05-18
### Added
* Add new languages Indonesian (`'ID'`) and Turkish (`'TR''`).


## [1.4.0] - 2022-04-13
### Added
* Add `error_message` field to document status if an error occurs during document translation fails,
  and check if detected source language matches target language. The deprecated `message` field is
  also added to match the live API. 
### Changed
* Update name for the target language `zh` to "Chinese (simplified)". 


## [1.3.2] - 2022-03-01
### Added
* Add support for `tag_handling=html`.
* `formality` parameter is checked against `target_lang`.
### Changed
* Update `package-lock.json`: upgrade `follow-redirects` to 1.14.9 to silence security warnings.
  Note: security vulnerability [CVE-2022-0536](https://nvd.nist.gov/vuln/detail/CVE-2022-0536)
  affects cross-domain proxying and has no impact here because the proxy server is restricted to
  target only the mock server itself.
### Fixed
* Raise request body size limits to 50 MiB.
* Fix error response message when attempting to download a document before it has been translated.


## [1.3.1] - 2022-01-21
### Added
* Add contribution guidelines -- currently we are unable to accept Pull Requests.
### Changed
* npm start command now uses environment variables if defined for DEEPL_MOCK_SERVER_PORT and 
  DEEPL_MOCK_PROXY_SERVER_PORT.
* Update `package-lock.json`: upgrade `follow-redirects` to 1.14.7 to silence security warnings. 
  Note: security vulnerability [CVE-2022-0155](https://nvd.nist.gov/vuln/detail/CVE-2022-0155)
  affects cross-domain proxying and has no impact here because the proxy server is restricted to
  target only the mock server itself.   
### Fixed
* Remove "localhost" from listen() calls.


## [1.3.0] - 2021-11-15
### Added
* Add glossary support for document translation. 
* Add missing argument validation for: formality, split_sentences, preserve_formatting and
  outline_detection.
* Add an optional proxy server that proxies requests to the mock server, listening on port 3001 by
  default.
* Add `expect-proxy` session variable to reject requests not via proxy, as determined by presence of
  the `Forwarded` header.
### Changed
* Require a non-empty `User-Agent` header for all endpoints.


## [1.2.0] - 2021-10-06
### Added
* Add support for `/v2/glossary-languages-pair` endpoint.
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
* Add support for Authorization header with `DeepL-Auth-Key ` prefix. 
### Fixed
* Fix bug in error responses introduced in eslint refactoring.


## [0.2.0] - 2021-08-03
### Added
* Use `eslint` and `airbnb` style for code checking.
### Fixed
* Fix issue when no array parameters are specified.


## [0.1.0] - 2021-07-30
Initial version.


[Unreleased]: https://github.com/DeepLcom/deepl-mock/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/DeepLcom/deepl-mock/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/DeepLcom/deepl-mock/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/DeepLcom/deepl-mock/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/DeepLcom/deepl-mock/releases/tag/v0.1.0
