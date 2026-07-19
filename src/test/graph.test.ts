import assert from 'node:assert/strict';
import test from 'node:test';
import { findCycles, stronglyConnectedComponents } from '../core/graph.js';
import type { GraphEdge } from '../types.js';

function edge(source: string, target: string): GraphEdge {
  return { source, target, specifier: target, line: 1, kind: 'import' };
}

test('Tarjan finds strongly connected components deterministically', () => {
  const components = stronglyConnectedComponents(
    ['d', 'c', 'b', 'a'],
    [edge('a', 'b'), edge('b', 'a'), edge('b', 'c'), edge('c', 'd')],
  );
  assert.deepEqual(components, [['d'], ['c'], ['a', 'b']]);
});

test('cycle detection includes self loops and excludes acyclic components', () => {
  const cycles = findCycles(['a', 'b', 'c'], [edge('a', 'b'), edge('b', 'a'), edge('c', 'c')]);
  assert.deepEqual(cycles.map((cycle) => cycle.nodes), [['a', 'b'], ['c']]);
});

test('SCC analysis handles graphs deeper than the JavaScript call stack', () => {
  const nodeIds = Array.from({ length: 25_000 }, (_, index) => `node-${String(index).padStart(5, '0')}`);
  const edges = nodeIds.slice(0, -1).map((node, index) => edge(node, nodeIds[index + 1] ?? ''));
  const components = stronglyConnectedComponents(nodeIds, edges);
  assert.equal(components.length, nodeIds.length);
  assert.deepEqual(components[0], [nodeIds.at(-1)]);
  assert.deepEqual(components.at(-1), [nodeIds[0]]);
});

test('SCC analysis ignores edges whose endpoints are outside the node set', () => {
  const components = stronglyConnectedComponents(['a'], [edge('a', 'missing'), edge('missing', 'a')]);
  assert.deepEqual(components, [['a']]);
});
