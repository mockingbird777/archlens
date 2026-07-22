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
  assert.deepEqual(impact.witnesses, {
    maxNodesPerPath: 256,
    maxTotalNodes: 40_000,
    materializedNodes: 13,
    omittedPaths: 0,
  });
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

test('keeps a 20,000-node chain linear by bounding witness materialization', () => {
  const chain = Array.from({ length: 20_000 }, (_, index) => `chain/${String(index).padStart(5, '0')}.ts`);
  const chainEdges = chain.slice(1).map((id, index) => edge(id, chain[index] ?? ''));
  const impact = traceChangeImpact(root, chain, chainEdges, [chain[0] ?? '']);
  const lastComplete = impact.nodes.find((node) => node.distance === 255);
  const firstOmitted = impact.nodes.find((node) => node.distance === 256);
  const finalNode = impact.nodes.find((node) => node.distance === 19_999);

  assert.equal(impact.affectedFiles, 19_999);
  assert.equal(impact.maxDistance, 19_999);
  assert.equal(impact.nodes.length, 20_000);
  assert.equal(lastComplete?.witnessPath.length, 256);
  assert.equal(lastComplete?.witnessPath.at(0), chain[0]);
  assert.equal(lastComplete?.witnessPath.at(-1), chain[255]);
  assert.deepEqual(firstOmitted?.witnessPath, []);
  assert.equal(firstOmitted?.witnessPathOmitted, true);
  assert.equal(firstOmitted?.changedFile, chain[0]);
  assert.deepEqual(finalNode?.witnessPath, []);
  assert.equal(finalNode?.witnessPathOmitted, true);
  assert.deepEqual(impact.witnesses, {
    maxNodesPerPath: 256,
    maxTotalNodes: 40_000,
    materializedNodes: 32_896,
    omittedPaths: 19_744,
  });
  assert.ok((impact.witnesses?.materializedNodes ?? Infinity) <= 40_000);
});

test('enforces a deterministic total witness materialization budget', () => {
  const seed = 'seed.ts';
  const middle = Array.from({ length: 7_000 }, (_, index) => `middle/${String(index).padStart(4, '0')}.ts`);
  const leaves = Array.from({ length: 9_000 }, (_, index) => `leaves/${String(index).padStart(4, '0')}.ts`);
  const graphEdges = [
    ...middle.map((id) => edge(id, seed)),
    ...leaves.map((id) => edge(id, middle[0] ?? '')),
  ];
  const impact = traceChangeImpact(root, [seed, ...middle, ...leaves], graphEdges, [seed]);
  const summary = impact.witnesses;
  const omitted = impact.nodes.filter((node) => node.witnessPathOmitted);

  assert.equal(impact.nodes.length, 16_001);
  assert.equal(impact.affectedFiles, 16_000);
  assert.equal(impact.maxDistance, 2);
  assert.ok(summary);
  assert.equal(summary.materializedNodes, impact.nodes.reduce((total, node) => total + node.witnessPath.length, 0));
  assert.ok(summary.materializedNodes <= summary.maxTotalNodes);
  assert.equal(summary.omittedPaths, omitted.length);
  assert.ok(summary.omittedPaths > 0);
  assert.ok(omitted.every((node) => node.witnessPath.length === 0));
  assert.ok(impact.nodes.every((node) => node.distance <= 2));
});
