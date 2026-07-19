import type { Cycle, GraphEdge, GraphNode, Hotspot, SourceFile } from '../types.js';

export function stronglyConnectedComponents(
  nodeIds: readonly string[],
  edges: readonly Pick<GraphEdge, 'source' | 'target'>[],
): string[][] {
  const adjacency = new Map<string, Set<string>>(nodeIds.map((id) => [id, new Set()]));
  for (const edge of edges) {
    if (adjacency.has(edge.target)) adjacency.get(edge.source)?.add(edge.target);
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  interface Frame {
    node: string;
    neighbors: string[];
    nextNeighbor: number;
  }

  function start(node: string, callStack: Frame[]): void {
    const index = nextIndex;
    nextIndex += 1;
    indices.set(node, index);
    lowLinks.set(node, index);
    stack.push(node);
    onStack.add(node);
    callStack.push({ node, neighbors: [...(adjacency.get(node) ?? [])].sort(), nextNeighbor: 0 });
  }

  for (const node of [...nodeIds].sort()) {
    if (indices.has(node)) continue;
    const callStack: Frame[] = [];
    start(node, callStack);
    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      if (!frame) break;
      const neighbor = frame.neighbors[frame.nextNeighbor];
      if (neighbor !== undefined) {
        frame.nextNeighbor += 1;
        if (!indices.has(neighbor)) {
          start(neighbor, callStack);
        } else if (onStack.has(neighbor)) {
          lowLinks.set(frame.node, Math.min(
            lowLinks.get(frame.node) ?? 0,
            indices.get(neighbor) ?? 0,
          ));
        }
        continue;
      }

      callStack.pop();
      const parent = callStack[callStack.length - 1];
      if (parent) {
        lowLinks.set(parent.node, Math.min(
          lowLinks.get(parent.node) ?? 0,
          lowLinks.get(frame.node) ?? 0,
        ));
      }
      if (lowLinks.get(frame.node) === indices.get(frame.node)) {
        const component: string[] = [];
        let current: string | undefined;
        do {
          current = stack.pop();
          if (current !== undefined) {
            onStack.delete(current);
            component.push(current);
          }
        } while (current !== frame.node && current !== undefined);
        components.push(component.sort());
      }
    }
  }
  return components;
}

export function findCycles(nodeIds: readonly string[], edges: readonly GraphEdge[]): Cycle[] {
  const selfLoops = new Set(edges.filter((edge) => edge.source === edge.target).map((edge) => edge.source));
  const components = stronglyConnectedComponents(nodeIds, edges)
    .filter((component) => component.length > 1 || (component[0] !== undefined && selfLoops.has(component[0])))
    .sort((left, right) => (left[0] ?? '').localeCompare(right[0] ?? ''));
  return components.map((nodes, index) => ({ id: index + 1, nodes, size: nodes.length }));
}

function normalizedLog(value: number, maximum: number): number {
  return maximum === 0 ? 0 : Math.log1p(value) / Math.log1p(maximum);
}

export function buildMetrics(
  files: readonly SourceFile[],
  edges: readonly GraphEdge[],
  cycles: readonly Cycle[],
): { nodes: GraphNode[]; hotspots: Hotspot[] } {
  const incoming = new Map<string, Set<string>>(files.map((file) => [file.id, new Set()]));
  const outgoing = new Map<string, Set<string>>(files.map((file) => [file.id, new Set()]));
  for (const edge of edges) {
    incoming.get(edge.target)?.add(edge.source);
    outgoing.get(edge.source)?.add(edge.target);
  }
  const cycleIds = new Map<string, number[]>();
  for (const cycle of cycles) {
    for (const node of cycle.nodes) cycleIds.set(node, [...(cycleIds.get(node) ?? []), cycle.id]);
  }
  const maximumIncoming = Math.max(0, ...[...incoming.values()].map((items) => items.size));
  const maximumOutgoing = Math.max(0, ...[...outgoing.values()].map((items) => items.size));
  const maximumLoc = Math.max(0, ...files.map((file) => file.loc));

  const nodes: GraphNode[] = files.map((file) => {
    const inDegree = incoming.get(file.id)?.size ?? 0;
    const outDegree = outgoing.get(file.id)?.size ?? 0;
    const cyclesForNode = cycleIds.get(file.id) ?? [];
    const rawScore = (
      0.4 * normalizedLog(inDegree, maximumIncoming)
      + 0.25 * normalizedLog(outDegree, maximumOutgoing)
      + 0.25 * normalizedLog(file.loc, maximumLoc)
      + 0.1 * Number(cyclesForNode.length > 0)
    );
    return {
      id: file.id,
      language: file.language,
      extension: file.extension,
      loc: file.loc,
      bytes: file.bytes,
      inDegree,
      outDegree,
      hotspotScore: Math.round(rawScore * 1000) / 10,
      cycleIds: cyclesForNode,
    };
  });

  const hotspots: Hotspot[] = nodes
    .map((node) => {
      const reasons: string[] = [];
      if (node.inDegree >= Math.max(2, Math.ceil(maximumIncoming * 0.6))) reasons.push('high fan-in');
      if (node.outDegree >= Math.max(2, Math.ceil(maximumOutgoing * 0.6))) reasons.push('high fan-out');
      if (node.loc >= Math.max(100, Math.ceil(maximumLoc * 0.75))) reasons.push('large file');
      if (node.cycleIds.length > 0) reasons.push('part of a cycle');
      if (reasons.length === 0) reasons.push('combined dependency and size pressure');
      return {
        id: node.id,
        score: node.hotspotScore,
        inDegree: node.inDegree,
        outDegree: node.outDegree,
        loc: node.loc,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 20);
  return { nodes, hotspots };
}
