# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Regression test locking in that a type-only namespace import (`import type * as X from '...'`) is recorded as exactly one import edge.
- Change-impact tracing with repeatable `--impact <file-or-directory>` flags, deterministic shortest witness paths, unmatched-path disclosure, and dedicated HTML, JSON, and Mermaid views.

## [0.2.0] - 2026-07-20

### Added

- `--open` for generating an HTML architecture report and launching it in the default browser in one command.

### Changed

- Reworked the README first-run path around a copy-paste command and verifiable terminal output.

## [0.1.0] - 2026-07-19

### Added

- Recursive, deterministic repository scanner with common generated-directory exclusions and foundational `.gitignore` support.
- Import extraction for JavaScript, TypeScript, Python, and Go.
- Local file/module resolution including TypeScript source behind `.js` specifiers and Go module paths.
- Tarjan strongly connected components analysis for circular dependencies.
- Hotspot scoring from fan-in, fan-out, LOC, and cycle membership.
- Self-contained interactive HTML, stable JSON, and Mermaid reports.
- Search, language filters, graph focus modes, node details, zoom, and pan in HTML reports.
- Zero-runtime-dependency CLI and programmatic API for Node.js 20+.
- Tests, polyglot fixtures, CI, security policy, contribution guide, and community templates.

[Unreleased]: https://github.com/mockingbird777/archlens/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mockingbird777/archlens/releases/tag/v0.2.0
[0.1.0]: https://github.com/mockingbird777/archlens/releases/tag/v0.1.0
