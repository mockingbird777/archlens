<div align="center">
  <img src="assets/banner.svg" alt="ArchLens — local-first repository intelligence" width="100%" />
</div>

<div align="center">
  <a href="https://github.com/mockingbird777/archlens/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mockingbird777/archlens/ci.yml?branch=main&style=flat-square" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-4de2c5?style=flat-square" /></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-5fa04e?style=flat-square" />
  <img alt="zero runtime dependencies" src="https://img.shields.io/badge/runtime_dependencies-0-7c8cff?style=flat-square" />
</div>

**ArchLens turns a source tree into an architecture map you can actually use.** One command finds local dependencies, circular dependency groups, change-risk hotspots, and the potential blast radius of a changed file across JavaScript, TypeScript, Python, and Go—then produces a private, self-contained interactive report.

No account. No upload. No background service. No runtime dependencies.

<p align="center"><a href="https://mockingbird777.github.io/archlens/"><strong>Explore the live interactive report →</strong></a></p>

### Map this repository in one command

Run ArchLens from any source repository. It writes one offline HTML file and opens it in your browser:

```bash
npx --yes github:mockingbird777/archlens . --open
```

```text
◈ ArchLens scanning /path/to/repository
✓ 30 files · 52 edges · 2 cycles
  Report: /path/to/repository/archlens-report.html
  Opened in your default browser.
```

<div align="center">
  <img src="assets/report-preview.svg" alt="Preview of the ArchLens interactive HTML report" width="100%" />
</div>

## Quick start

Requires [Node.js 20 or newer](https://nodejs.org/).

```bash
# Generate a report without opening it
npx --yes github:mockingbird777/archlens .

# Trace every importer that could be affected by a change
npx --yes github:mockingbird777/archlens . --impact src/config.ts --open

# Open the generated report
open archlens-report.html       # macOS
xdg-open archlens-report.html  # Linux
```

Or install the GitHub repository globally:

```bash
npm install --global github:mockingbird777/archlens
archlens ./your-repository
```

The install runs the repository's `prepare` script to compile TypeScript before the CLI starts. npm registry commands such as `npx archlens` are intentionally not documented until a package is published there.

## Why ArchLens?

Dependency graphs are often either too shallow to guide a refactor or locked behind a hosted platform. ArchLens aims for the useful middle: a fast, auditable local CLI with enough repository intelligence for code review, onboarding, and architectural cleanup.

- **Find cycles before they harden.** Tarjan's strongly connected components algorithm identifies complete circular dependency groups, including self-loops.
- **Prioritize risky files.** A transparent hotspot score combines unique fan-in, unique fan-out, file size, and cycle membership.
- **Preview a change's blast radius.** Reverse dependency tracing shows potentially affected importers, their distance, and a shortest witness path; repeat `--impact` for multi-file changes.
- **Understand polyglot repositories.** Analyze JS/TS ESM, CommonJS, Python imports, and local Go module imports in one pass.
- **Share a report, not your source.** The HTML report contains graph metadata only and makes no network requests.
- **Automate architecture checks.** Stable JSON and Mermaid output are easy to consume in CI, pull requests, or docs.
- **Trust the toolchain.** ArchLens itself ships with zero runtime dependencies and uses only Node.js built-ins.

## What it produces

### Interactive HTML

The default report is a single portable file with:

- live file search and language filters;
- cycle-only and hotspot-only focus modes;
- an impact-only focus mode with changed-file and affected-file markers;
- zoomable and pannable dependency graph;
- clickable node details with LOC, fan-in, fan-out, and cycle membership;
- hotspot ranking, cycle summaries, and an embedded machine-readable dataset;
- responsive layout and no CDN, analytics, fonts, or remote assets.

```bash
npx --yes github:mockingbird777/archlens . --title "Payments service architecture"
```

### JSON

Use the versioned schema for scripts and CI:

```bash
npx --yes github:mockingbird777/archlens . --format json --stdout > architecture.json
```

The document includes `meta`, `summary`, `nodes`, `edges`, `unresolvedImports`, `cycles`, `hotspots`, optional `impact`, and non-fatal `warnings`. Impact results include deterministic shortest witness paths from each changed file to a potential importer. Paths are repository-relative; source contents and absolute paths are never emitted.

### Mermaid

Keep a graph next to your technical documentation:

```bash
npx --yes github:mockingbird777/archlens ./packages/core --format mermaid --output docs/core-graph.mmd
```

## CLI reference

```text
archlens [path] [options]

-f, --format <type>    html (default), json, or mermaid
-o, --output <file>    Output path; use - for stdout
    --stdout           Write the report to stdout
    --include <glob>   Only scan matching files (repeatable)
    --exclude <glob>   Ignore matching paths (repeatable)
    --impact <path>    Trace potential importers of a changed path (repeatable)
    --no-gitignore     Do not read .gitignore files
    --max-files <n>    Safety limit (default: 20000)
    --title <text>     Custom HTML report title
    --open             Open the generated HTML report
-q, --quiet            Suppress progress and summary
-h, --help             Show help
-v, --version          Show the version
```

Examples:

```bash
npx --yes github:mockingbird777/archlens . --exclude '**/*.test.ts' --exclude 'generated/**'
npx --yes github:mockingbird777/archlens . --include 'packages/**' --max-files 50000
npx --yes github:mockingbird777/archlens services/api -f json -o artifacts/api-architecture.json
npx --yes github:mockingbird777/archlens . --impact packages/core --impact src/config.ts --open
```

ArchLens always skips common generated or heavyweight directories such as `.git`, `node_modules`, `dist`, `build`, `coverage`, `vendor`, virtual environments, and language caches. It also evaluates common `.gitignore` rules, including wildcards, anchored paths, directory rules, and negation.

## Language support

| Language | Recognized syntax | Local resolution |
| --- | --- | --- |
| JavaScript / TypeScript | `import`, side-effect import, re-export, dynamic `import()`, `require()` | relative files, extensionless files, directory indexes, TS source behind `.js` specifiers |
| Python | `import`, aliased/multiple imports, `from … import`, relative imports | module files and package `__init__.py` from the source directory or repository root |
| Go | single, grouped, aliased, blank, and dot imports | packages under the module path declared by `go.mod`, plus relative imports |

External packages are counted but deliberately excluded from the local file graph. Imports that look local but cannot be resolved are reported separately so configuration gaps remain visible.

## How it works

```mermaid
flowchart LR
  A[Repository walker] --> B[Language import parsers]
  B --> C[Local module resolver]
  C --> D[Dependency graph]
  D --> E[Tarjan SCC cycles]
  D --> F[Hotspot metrics]
  D --> H[Reverse impact tracing]
  E --> G[HTML / JSON / Mermaid]
  F --> G
  H --> G
```

The implementation is intentionally layered:

```text
src/
├── analyzers/   # Dependency extraction per language
├── core/        # Walking, ignores, resolution, SCC, metrics
├── reporters/   # Self-contained HTML, JSON, Mermaid
├── test/        # node:test unit and integration tests
├── cli.ts       # Argument parsing and terminal UX
└── index.ts     # Public programmatic API
```

Install from GitHub, then use it as a library:

```bash
npm install github:mockingbird777/archlens
```

```ts
import { analyzeRepository } from 'archlens';

const result = await analyzeRepository({
  root: './my-repo',
  exclude: ['generated/**'],
});

console.log(result.cycles);
```

`impact` paths can name a scanned source file or a directory. ArchLens follows local import edges in reverse, keeps cycles bounded, and selects a deterministic shortest witness when several changed files can reach the same importer. This is a structural “may be affected” signal—not a claim that every reachable file must change.

## Hotspot score

Scores are relative to the scanned repository and range from 0 to 100:

```text
40% normalized fan-in
25% normalized fan-out
25% normalized LOC
10% circular-dependency membership
```

Log normalization keeps one generated mega-file from flattening every other signal. The score is a prioritization aid—not a claim about code quality.

## Privacy and security

ArchLens runs entirely on your machine. It does not make network calls, execute scanned code, evaluate configuration files, or include source text in reports. Reports contain relative file paths and import specifiers, which can still be sensitive; review them before sharing outside your organization.

See [SECURITY.md](SECURITY.md) for responsible disclosure and the threat model.

## Current boundaries

ArchLens favors predictable zero-configuration analysis over compiler-level completeness. It does not yet evaluate TypeScript path aliases, bundler aliases, Python environment/package metadata, Go workspaces, conditional imports, or computed import strings. Parser false positives and unresolved edges are possible in syntactically unusual code. Please open a small reproduction when you find one.

## Roadmap

- [ ] `tsconfig.json` and package `exports` resolution
- [ ] configurable architecture boundaries and CI exit policies
- [ ] graph diffing between commits
- [ ] ownership and churn overlays from local Git history
- [ ] Rust and Java/Kotlin analyzers
- [ ] plugin API for organization-specific resolvers

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), follow the [Code of Conduct](CODE_OF_CONDUCT.md), and run `npm test` before submitting a change. Good first contributions include focused parser fixtures, resolver edge cases, report accessibility, and performance profiles from large public repositories. Not ready to code? A small public repository that ArchLens misreads is an equally valuable bug report.

## License

[MIT](LICENSE) © 2026 ArchLens contributors.
