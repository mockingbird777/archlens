import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { traceChangeImpact } from '../core/impact.js';
import type { GraphEdge } from '../types.js';

function edge(source: string, target: string): GraphEdge {
  return { source, target, specifier: `./${target}`, line: 1, kind: 'import' };
}

const root = path.resolve('/tmp/archlens-impact-fixture');
const nodes = [
  'changed/a.ts',
  'changed/b.ts',
  'cycle.ts',
  'mid-a.ts',
  'mid-b.ts',
  'top.ts',
];
const edges = [
  edge('mid-a.ts', 'changed/a.ts'),
  edge('mid-b.ts', 'changed/b.ts'),
  edge('top.ts', 'mid-a.ts'),
  edge('top.ts', 'mid-b.ts'),
  edge('cycle.ts', 'top.ts'),
  edge('top.ts', 'cycle.ts'),
];

test('traces reverse dependencies with deterministic shortest witness paths', () => {
  const impact = traceChangeImpact(root, nodes, edges, ['changed']);
  assert.deepEqual(impact.seeds, ['changed/a.ts', 'changed/b.ts']);
  assert.equal(impact.affectedFiles, 4);
  assert.equal(impact.maxDistance, 3);
  assert.deepEqual(
    impact.nodes.find((node) => node.id === 'top.ts'),
    {
      id: 'top.ts',
      distance: 2,
      changedFile: 'changed/a.ts',
      witnessPath: ['changed/a.ts', 'mid-a.ts', 'top.ts'],
    },
  );
  assert.equal(impact.nodes.filter((node) => node.id === 'cycle.ts').length, 1);
});

test('normalizes requests, accepts in-repository absolute paths, and reports unmatched paths', () => {
  const impact = traceChangeImpact(root, nodes, edges, [
    '.\\changed\\a.ts',
    path.join(root, 'changed/a.ts'),
    'missing.ts',
  ]);
  assert.deepEqual(impact.requested, ['changed/a.ts', 'missing.ts']);
  assert.deepEqual(impact.seeds, ['changed/a.ts']);
  assert.deepEqual(impact.unmatched, ['missing.ts']);
});

test('rejects impact paths outside the repository boundary', () => {
  assert.throws(
    () => traceChangeImpact(root, nodes, edges, ['../secret.ts']),
    /outside the repository/,
  );
});

test('treats the repository root as an explicit directory request', () => {
  const impact = traceChangeImpact(root, nodes, edges, ['.']);
  assert.deepEqual(impact.requested, ['.']);
  assert.deepEqual(impact.seeds, [...nodes].sort());
  assert.equal(impact.affectedFiles, 0);
});
