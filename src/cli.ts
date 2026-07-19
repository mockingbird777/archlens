import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzeRepository, VERSION } from './core/analyze.js';
import { renderReport, type ReportFormat } from './reporters/index.js';

interface CliOptions {
  root: string;
  format: ReportFormat;
  output?: string;
  stdout: boolean;
  useGitignore: boolean;
  include: string[];
  exclude: string[];
  maxFiles: number;
  title?: string;
  quiet: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `
ArchLens ${VERSION} — local-first repository intelligence

Usage
  archlens [path] [options]

Options
  -f, --format <type>    html (default), json, or mermaid
  -o, --output <file>    Output path; use - for stdout
      --stdout           Write the report to stdout
      --include <glob>   Only scan matching files (repeatable)
      --exclude <glob>   Ignore matching paths (repeatable)
      --no-gitignore     Do not read .gitignore files
      --max-files <n>    Safety limit (default: 20000)
      --title <text>     Custom HTML report title
  -q, --quiet            Suppress progress and summary
  -h, --help             Show this help
  -v, --version          Show the version

Examples
  archlens .
  archlens ./services/api --format json --stdout
  archlens . --exclude '**/*.test.ts' --output architecture.html
`;

function takeValue(args: readonly string[], index: number, flag: string, allowDash = false): string {
  const value = args[index + 1];
  if (!value || (value.startsWith('-') && !(allowDash && value === '-'))) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  let root = '.';
  let rootSeen = false;
  let format: ReportFormat = 'html';
  let output: string | undefined;
  let stdout = false;
  let useGitignore = true;
  const include: string[] = [];
  const exclude: string[] = [];
  let maxFiles = 20_000;
  let title: string | undefined;
  let quiet = false;
  let help = false;
  let version = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    if (argument === '--') {
      const remaining = args.slice(index + 1);
      if (remaining.length > 1 || rootSeen) throw new Error('Only one repository path may be provided.');
      if (remaining[0]) root = remaining[0];
      break;
    }
    if (argument === '-h' || argument === '--help') help = true;
    else if (argument === '-v' || argument === '--version') version = true;
    else if (argument === '-q' || argument === '--quiet') quiet = true;
    else if (argument === '--stdout') stdout = true;
    else if (argument === '--no-gitignore') useGitignore = false;
    else if (argument === '-f' || argument === '--format') {
      const value = takeValue(args, index, argument);
      if (!['html', 'json', 'mermaid'].includes(value)) throw new Error(`Unknown format "${value}". Choose html, json, or mermaid.`);
      format = value as ReportFormat;
      index += 1;
    } else if (argument === '-o' || argument === '--output') {
      output = takeValue(args, index, argument, true);
      index += 1;
    } else if (argument === '--include') {
      include.push(takeValue(args, index, argument));
      index += 1;
    } else if (argument === '--exclude') {
      exclude.push(takeValue(args, index, argument));
      index += 1;
    } else if (argument === '--max-files') {
      const value = takeValue(args, index, argument);
      maxFiles = Number(value);
      if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) throw new Error('--max-files must be a positive integer.');
      index += 1;
    } else if (argument === '--title') {
      title = takeValue(args, index, argument);
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option "${argument}". Run archlens --help for usage.`);
    } else if (rootSeen) {
      throw new Error(`Unexpected argument "${argument}". Only one repository path may be provided.`);
    } else {
      root = argument;
      rootSeen = true;
    }
  }
  if (stdout && output !== undefined && output !== '-') {
    throw new Error('--stdout cannot be combined with --output unless the output is "-".');
  }
  const result: CliOptions = { root, format, stdout, useGitignore, include, exclude, maxFiles, quiet, help, version };
  if (output !== undefined) result.output = output;
  if (title !== undefined) result.title = title;
  return result;
}

function defaultOutput(format: ReportFormat): string {
  if (format === 'json') return 'archlens-report.json';
  if (format === 'mermaid') return 'archlens-graph.mmd';
  return 'archlens-report.html';
}

export async function run(args: readonly string[]): Promise<void> {
  const options = parseCliArgs(args);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  const toStdout = options.stdout || options.output === '-';
  if (!options.quiet && !toStdout) process.stderr.write(`◈ ArchLens scanning ${path.resolve(options.root)}\n`);
  const result = await analyzeRepository({
    root: options.root,
    useGitignore: options.useGitignore,
    include: options.include,
    exclude: options.exclude,
    maxFiles: options.maxFiles,
  });
  const content = renderReport(result, options.format, options.title);
  if (toStdout) {
    process.stdout.write(content);
  } else {
    const outputPath = path.resolve(options.output ?? defaultOutput(options.format));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
    if (!options.quiet) {
      process.stderr.write(`✓ ${result.summary.files} files · ${result.summary.dependencies} edges · ${result.summary.cycles} cycles\n`);
      process.stderr.write(`  Report: ${outputPath}\n`);
      if (result.warnings.length > 0) process.stderr.write(`  ${result.warnings.length} scan warning(s) recorded in the report.\n`);
    }
  }
}
