import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Language, ScanOptions, ScanResult, SourceFile } from '../types.js';
import { isIgnored, matchesGlob, parseGitignore, type IgnoreRule } from './ignore.js';
import { countLines, extensionOf, relativeId, toPosix } from './paths.js';

const LANGUAGES: Readonly<Record<string, Language>> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.py': 'python',
  '.go': 'go',
};

function languageFor(filePath: string): Language | undefined {
  return LANGUAGES[extensionOf(filePath)];
}

function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' ? code : 'unknown filesystem error';
}

async function loadLocalRules(directory: string, root: string): Promise<IgnoreRule[]> {
  const ignorePath = path.join(directory, '.gitignore');
  try {
    const content = await fs.readFile(ignorePath, 'utf8');
    const base = toPosix(path.relative(root, directory));
    return parseGitignore(content, base);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
}

export async function scanRepository(options: ScanOptions): Promise<ScanResult> {
  const root = path.resolve(options.root);
  const files: SourceFile[] = [];
  const warnings: string[] = [];

  async function walk(directory: string, inheritedRules: readonly IgnoreRule[]): Promise<void> {
    let activeRules = inheritedRules;
    if (options.useGitignore) {
      try {
        activeRules = [...inheritedRules, ...(await loadLocalRules(directory, root))];
      } catch (error) {
        warnings.push(`Could not read ${relativeId(root, path.join(directory, '.gitignore'))}: ${errorCode(error)}`);
      }
    }

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Could not read directory ${relativeId(root, directory) || '.'}: ${errorCode(error)}`);
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      const id = relativeId(root, absolutePath);
      if (entry.isDirectory()) {
        if (!isIgnored(id, true, activeRules, options.exclude)) await walk(absolutePath, activeRules);
        continue;
      }
      if (!entry.isFile() || isIgnored(id, false, activeRules, options.exclude)) continue;
      const language = languageFor(entry.name);
      if (!language) continue;
      if (options.include.length > 0 && !options.include.some((glob) => matchesGlob(id, glob))) continue;
      if (files.length >= options.maxFiles) {
        throw new Error(`File limit exceeded (${options.maxFiles}). Raise it with --max-files or narrow the scan with --exclude.`);
      }
      try {
        const [content, stat] = await Promise.all([
          fs.readFile(absolutePath, 'utf8'),
          fs.stat(absolutePath),
        ]);
        files.push({
          id,
          absolutePath,
          language,
          extension: extensionOf(entry.name),
          content,
          loc: countLines(content),
          bytes: stat.size,
        });
      } catch (error) {
        warnings.push(`Could not read file ${id}: ${errorCode(error)}`);
      }
    }
  }

  await walk(root, []);
  files.sort((left, right) => left.id.localeCompare(right.id));
  return { files, warnings };
}

export const supportedExtensions = Object.freeze(Object.keys(LANGUAGES));
