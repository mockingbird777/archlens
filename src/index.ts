export { analyzeRepository, VERSION } from './core/analyze.js';
export { scanRepository, supportedExtensions } from './core/scanner.js';
export { findCycles, stronglyConnectedComponents } from './core/graph.js';
export { traceChangeImpact } from './core/impact.js';
export { parseGoImports } from './analyzers/go.js';
export { parseJavaScriptImports } from './analyzers/javascript.js';
export { parsePythonImports } from './analyzers/python.js';
export type {
  AnalysisResult,
  AnalyzeOptions,
  ChangeImpact,
  Cycle,
  GraphEdge,
  GraphNode,
  Hotspot,
  ImpactNode,
  ImpactWitnessSummary,
  Language,
  UnresolvedImport,
} from './types.js';
