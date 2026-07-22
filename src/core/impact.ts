import path from 'node:path';
import type { ChangeImpact, GraphEdge } from '../types.js';

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function normalizeRequest(root: string, request: string): string {
  const normalizedInput = toPosix(request.trim());
  if (!normalizedInput) throw new Error('--impact paths cannot be empty.');
  const resolved = path.resolve(root, normalizedInput);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Impact path is outside the repository: ${request}`);
  }
  return toPosix(relative).replace(/^\.\//, '').replace(/\/$/, '') || '.';
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * Follow dependency edges in reverse to estimate which importers may be
 * affected by changes to one or more files. This is structural reachability,
 * not a claim that every reachable file will require a code change.
 */
export function traceChangeImpact(
  root: string,
  nodeIds: readonly string[],
  edges: readonly GraphEdge[],
  requests: readonly string[],
): ChangeImpact {
  const ids = uniqueSorted(nodeIds);
  const idSet = new Set(ids);
  const requested = uniqueSorted(requests.map((request) => normalizeRequest(root, request)));
  const seeds = new Set<string>();
  const unmatched: string[] = [];

  for (const request of requested) {
    if (idSet.has(request)) {
      seeds.add(request);
      continue;
    }
    const prefix = request === '.' ? '' : `${request}/`;
    const matches = prefix ? ids.filter((id) => id.startsWith(prefix)) : ids;
    if (matches.length === 0) unmatched.push(request);
    else for (const match of matches) seeds.add(match);
  }

  const sortedSeeds = uniqueSorted(seeds);
  const reverse = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    const importers = reverse.get(edge.target) ?? new Set<string>();
    importers.add(edge.source);
    reverse.set(edge.target, importers);
  }

  const best = new Map<string, { distance: number; changedFile: string; witnessPath: string[] }>();
  const queue: string[] = [];
  for (const seed of sortedSeeds) {
    best.set(seed, { distance: 0, changedFile: seed, witnessPath: [seed] });
    queue.push(seed);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    const currentBest = best.get(current);
    if (!currentBest) continue;
    const importers = uniqueSorted(reverse.get(current) ?? []);
    for (const importer of importers) {
      if (best.has(importer)) continue;
      best.set(importer, {
        distance: currentBest.distance + 1,
        changedFile: currentBest.changedFile,
        witnessPath: [...currentBest.witnessPath, importer],
      });
      queue.push(importer);
    }
  }

  const nodes = [...best.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
  return {
    requested,
    seeds: sortedSeeds,
    unmatched,
    affectedFiles: Math.max(0, nodes.length - sortedSeeds.length),
    maxDistance: nodes.reduce((maximum, node) => Math.max(maximum, node.distance), 0),
    nodes,
  };
}
