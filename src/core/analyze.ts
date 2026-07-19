import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseImports } from '../analyzers/index.js';
import type {
  AnalysisResult,
  AnalyzeOptions,
  GraphEdge,
  Language,
  ScanOptions,
  UnresolvedImport,
} from '../types.js';
import { buildMetrics, findCycles } from './graph.js';
import { resolveImport, type ResolutionContext } from './resolver.js';
import { scanRepository } from './scanner.js';

export const VERSION = '0.1.0';

async function readGoModule(root: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(path.join(root, 'go.mod'), 'utf8');
    return content.match(/^\s*module\s+(\S+)/m)?.[1];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function analyzeRepository(options: AnalyzeOptions): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const root = path.resolve(options.root);
  const stat = await fs.stat(root).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error(`Repository path does not exist: ${root}`);
    throw error;
  });
  if (!stat.isDirectory()) throw new Error(`Repository path is not a directory: ${root}`);

  const scanOptions: ScanOptions = {
    root,
    useGitignore: options.useGitignore ?? true,
    include: options.include ?? [],
    exclude: options.exclude ?? [],
    maxFiles: options.maxFiles ?? 20_000,
  };
  const scan = await scanRepository(scanOptions);
  const byId = new Map(scan.files.map((file) => [file.id, file]));
  const goModule = await readGoModule(root);
  const context: ResolutionContext = goModule
    ? { files: scan.files, byId, goModule }
    : { files: scan.files, byId };
  const edges: GraphEdge[] = [];
  const unresolvedImports: UnresolvedImport[] = [];

  for (const file of scan.files) {
    for (const reference of parseImports(file)) {
      const resolution = resolveImport(file, reference, context);
      if (resolution.classification === 'resolved' && resolution.target) {
        edges.push({
          source: file.id,
          target: resolution.target,
          specifier: reference.specifier,
          line: reference.line,
          kind: reference.kind,
        });
      } else {
        unresolvedImports.push({
          source: file.id,
          specifier: reference.specifier,
          line: reference.line,
          kind: reference.kind,
          classification: resolution.classification === 'resolved' ? 'unresolved-local' : resolution.classification,
        });
      }
    }
  }
  edges.sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target) || left.line - right.line);
  unresolvedImports.sort((left, right) => left.source.localeCompare(right.source) || left.line - right.line || left.specifier.localeCompare(right.specifier));
  const cycles = findCycles(scan.files.map((file) => file.id), edges);
  const { nodes, hotspots } = buildMetrics(scan.files, edges, cycles);
  const languages: Partial<Record<Language, number>> = {};
  for (const file of scan.files) languages[file.language] = (languages[file.language] ?? 0) + 1;

  return {
    meta: {
      schemaVersion: 1,
      tool: 'archlens',
      version: VERSION,
      rootName: path.basename(root),
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    summary: {
      files: scan.files.length,
      dependencies: edges.length,
      externalImports: unresolvedImports.filter((item) => item.classification === 'external').length,
      unresolvedLocalImports: unresolvedImports.filter((item) => item.classification === 'unresolved-local').length,
      cycles: cycles.length,
      languages,
      totalLoc: scan.files.reduce((total, file) => total + file.loc, 0),
    },
    nodes,
    edges,
    unresolvedImports,
    cycles,
    hotspots,
    warnings: scan.warnings,
  };
}
