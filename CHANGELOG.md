# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
* `/v2/usage` endpoint: Now returns additional fields: `products`, `api_key_character_count`, `api_key_character_limit`, `start_time`, and `end_time` in the response, matching the latest DeepL API spec.

## [1.17.4] - 2025-04-22
### Added
* Add support for dot notation for x-www-form-encoded requests
### Fixed
* Fix path override functionality

## [1.17.3] - 2025-03-31
### Fixed
* Fixed dictionary entry merging in v3 glossary update function.

## [1.17.2] - 2025-03-26
### Added
* Fix language code comparisons to be case-insensitive

## [1.17.1] - 2025-03-20
### Added
* Fix erroneous copyright year changes

## [1.17.0] - 2025-03-18
### Added
* Add support for the v3 glossary endpoints in the mock server

## [1.16.3] - 2025-03-05
### Added
* Add additional path for testing path overrides

## [1.16.2] - 2025-02-12
### Fixed
* Return error when both writing style and tone are provided in the same request

## [1.16.1] - 2025-01-23
### Added
* Fix allowed values for writing styles.

## [1.16.0] - 2025-01-22
### Added
* Added checks for supported languages in the Write API.

## [1.15.3] - 2025-01-17
### Fixed
* Fix BCP-47 conversion for languages without hyphens.
* Accept variant-less target languages for Write (server chooses default variant).


## [1.15.2] - 2025-01-17
### Fixed
* Fix typo in util function that causes a crash.


## [1.15.1] - 2025-01-17
### Fixed
* `v2/write/rephrase` now returns the target language in BCP-47 format,
  like the real API.


## [1.15.0] - 2025-01-15
### Added
* Added support for the Write API in the mock server.


## [1.14.1] - 2025-01-14
### Fixed
* Update `path-to-regexp` dependency due to CVE-2024-52798
* Update `cross-spawn` dependency due to CVE-2024-21538


## [1.14.0] - 2024-11-15
### Added
* `/translate` endpoint: added `model_type` request parameter and
  `model_type_used` response parameter.


## [1.13.0] - 2024-09-13
### Added
* Add supported glossary languages: Danish (`'da'`), Norwegian (bokmål)
  (`'nb'`), and Swedish (`'sv'`).
* Add billed characters to translate-text function: (`show_billed_characters`
  request parameter, and `billed_characters` response parameter).


## [1.12.0] - 2024-04-08
### Added
* Verify keepalive is used by clients by rejecting session reuse on new sockets,
  except in case where no-response mode is active
* Add `mock-server-session-allow-missing-user-agent` session header to override
  missing User-Agent check.
* Add supported glossary languages: Portuguese (`'PT'`), Russian (`'RU'`), and Chinese (`'ZH'`).
* Add `output_format` parameter for document upload, to specify the desired file
  format of the output file
* Add new language Arabic (`'AR'`).
### Security
* Run `npm audit fix` to update dependencies.


## [1.11.0] - 2023-07-06
### Added
* Add formality for Japanese (`'JA'`).
* Add JSON-requests support to certain endpoints, matching DeepL API.


## [1.10.0] - 2023-01-26
### Added
* Add new languages Korean (`'KO'`) and Norwegian (bokmål) (`'NB'`).
* Add limited support for XLIFF files. As this mock server only translates text
  files, XLIFF files will return a 503 error (the same as for other file types).


## [1.9.1] - 2022-12-07
### Fixed
* `formality=default` is allowed for all target languages.


## [1.9.0] - 2022-11-03
### Added
* Add to supported glossary language pairs:
  - English <-> Dutch


## [1.8.1] - 2022-11-03
### Fixed
* Mock server incorrectly supported JSON requests that are not supported by
  DeepL API. Support for JSON requests is removed.
  * [#3](https://github.com/DeepLcom/deepl-mock/issues/3)
    thanks to [DevViktorKovacs](https://github.com/DevViktorKovacs).


## [1.8.0] - 2022-09-26
### Added
* Add `formality` options: `prefer_less` and `prefer_more`
### Fixed
* Glossary language codes are case-insensitive.


## [1.7.0] - 2022-09-09
### Added
* Add to supported glossary language pairs:
  - German <-> French
  - English <-> Italian
  - English <-> Japanese
  - English <-> Polish
* Add new language Ukrainian (`'UK'`).
### Fixed
* Fix bug with missing `target_lang` or `source_lang` in glossary create.


## [1.6.0] - 2022-07-07
### Added
* Add support for glossary creation using CSV format.
### Changed
* Update contributing guidelines, we can now accept Pull Requests.
* Update `package-lock.json`: remove `dicer` 0.3.0 from indirect dependencies.
### Fixed
* Fix an incorrect docker command in the readme.
  * Pull request [#2](https://github.com/DeepLcom/deepl-mock/pull/2)
    thanks to [qyanu](https://github.com/qyanu).


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

# Version Comparisons

[Unreleased]: https://github.com/DeepLcom/deepl-mock/compare/v1.17.4...HEAD
[1.17.4]: https://github.com/DeepLcom/deepl-mock/compare/v1.17.3...HEAD
[1.17.3]: https://github.com/DeepLcom/deepl-mock/compare/v1.17.2...v1.17.3
[1.17.2]: https://github.com/DeepLcom/deepl-mock/compare/v1.17.1...v1.17.2
[1.17.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.17.0...v1.17.1
[1.17.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.16.3...v1.17.0
[1.16.3]: https://github.com/DeepLcom/deepl-mock/compare/v1.16.2...v1.16.3
[1.16.2]: https://github.com/DeepLcom/deepl-mock/compare/v1.16.1...v1.16.2
[1.16.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.16.0...v1.16.1
[1.16.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.15.3...v1.16.0
[1.15.3]: https://github.com/DeepLcom/deepl-mock/compare/v1.15.2...v1.15.3
[1.15.2]: https://github.com/DeepLcom/deepl-mock/compare/v1.15.2...v1.15.2
[1.15.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.15.0...v1.15.1
[1.15.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.14.1...v1.15.0
[1.14.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.14.0...v1.14.1
[1.14.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/DeepLcom/deepl-mock/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/DeepLcom/deepl-mock/compare/v1.5.0...v1.6.0
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
