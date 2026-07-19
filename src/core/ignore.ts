import path from 'node:path';
import { toPosix } from './paths.js';

export interface IgnoreRule {
  base: string;
  pattern: string;
  negated: boolean;
  directoryOnly: boolean;
  hasSlash: boolean;
}

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.idea', '.vscode',
  'node_modules', 'bower_components', 'vendor',
  'dist', 'build', 'coverage', '.next', '.nuxt', '.output',
  'target', 'out', 'obj',
  '.venv', 'venv', 'env', '__pycache__', '.mypy_cache', '.pytest_cache',
]);

function escapeRegex(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

export function globToRegex(glob: string): RegExp {
  let expression = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index] ?? '';
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          expression += '(?:.*/)?';
        } else {
          expression += '.*';
        }
      } else {
        expression += '[^/]*';
      }
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += escapeRegex(character);
    }
  }
  return new RegExp(`${expression}$`);
}

export function matchesGlob(value: string, glob: string): boolean {
  const normalized = toPosix(value).replace(/^\.\//, '');
  const pattern = glob.replace(/^\.\//, '').replace(/^\//, '');
  if (pattern.includes('/')) return globToRegex(pattern).test(normalized);
  return normalized.split('/').some((part) => globToRegex(pattern).test(part));
}

export function parseGitignore(content: string, base: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }
    if (line.startsWith('\\#') || line.startsWith('\\!')) line = line.slice(1);
    const directoryOnly = line.endsWith('/');
    if (directoryOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/');
    if (anchored) line = line.slice(1);
    if (!line) continue;
    rules.push({
      base,
      pattern: line,
      negated,
      directoryOnly,
      hasSlash: anchored || line.includes('/'),
    });
  }
  return rules;
}

function ruleMatches(rule: IgnoreRule, rootRelativePath: string, isDirectory: boolean): boolean {
  const relativeToBase = toPosix(path.posix.relative(rule.base || '.', rootRelativePath));
  if (relativeToBase.startsWith('../') || relativeToBase === '..') return false;
  if (rule.directoryOnly && !isDirectory) return false;
  if (rule.hasSlash) return globToRegex(rule.pattern).test(relativeToBase);
  return relativeToBase.split('/').some((part) => globToRegex(rule.pattern).test(part));
}

export function isIgnored(
  rootRelativePath: string,
  isDirectory: boolean,
  rules: readonly IgnoreRule[],
  extraExcludes: readonly string[],
): boolean {
  const normalized = toPosix(rootRelativePath);
  const basename = path.posix.basename(normalized);
  // These directories are a hard safety/performance boundary, not ordinary
  // gitignore defaults. A repository rule must not re-include dependency or
  // generated trees that ArchLens promises to always skip.
  if (isDirectory && DEFAULT_IGNORED_DIRECTORIES.has(basename)) return true;
  let ignored = false;
  for (const pattern of extraExcludes) {
    if (matchesGlob(normalized, pattern)) ignored = true;
  }
  for (const rule of rules) {
    if (ruleMatches(rule, normalized, isDirectory)) ignored = !rule.negated;
  }
  return ignored;
}
