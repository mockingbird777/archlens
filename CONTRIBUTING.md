# Contributing to ArchLens

Thanks for helping make repository architecture easier to understand. ArchLens values focused changes, reproducible examples, and behavior that remains useful without a hosted service.

## Before you start

- Search existing issues and discussions before opening a new one.
- For a large feature or a new language, open a proposal first so the data model and maintenance cost can be discussed.
- Security concerns belong in the private process described in [SECURITY.md](SECURITY.md), not a public issue.

## Development setup

You need Node.js 20 or newer.

```bash
git clone https://github.com/mockingbird777/archlens.git
cd archlens
npm install
npm test
```

Useful commands:

```bash
npm run build           # compile TypeScript into dist/
npm run check           # strict type-check without emitting
npm test                # build and run the node:test suite
node bin/archlens.js .  # analyze this repository
```

## Making a change

1. Create a short branch from `main`.
2. Keep the change scoped to one behavior or concern.
3. Add a minimal fixture for parser or resolver changes. Fixtures should be synthetic and must not contain proprietary source.
4. Add or update tests for observable behavior.
5. Run `npm test` and inspect an HTML report if your change affects presentation.
6. Update the README or changelog when users need to know about the change.

ArchLens has zero runtime dependencies by design. A proposed runtime dependency needs a clear security, size, and maintenance justification. Development dependencies are acceptable when they materially improve the release process.

## Design principles

- **Local-first:** source code and analysis stay on the user's machine.
- **Safe by inspection:** never execute scanned source or repository configuration.
- **Useful over magical:** unresolved imports should be visible, not silently guessed.
- **Deterministic:** the same tree should produce stable node, edge, and cycle ordering.
- **Portable:** default reports should work offline as a single file.
- **Approachable internals:** prefer small parsers and explicit algorithms over hidden framework behavior.

## Pull requests

Use the pull request template and explain the user-visible outcome. Include test evidence and, for report changes, a screenshot or generated artifact. Maintainers may ask to split unrelated work. By contributing, you agree that your contribution is licensed under the MIT License.

## Reporting parser gaps

Please include:

- the language and file extension;
- the smallest import statement that reproduces the problem;
- expected source and target paths;
- relevant package/module configuration;
- ArchLens and Node.js versions.

Thank you for contributing.
