export type Language = 'javascript' | 'typescript' | 'python' | 'go';

export type ImportKind =
  | 'import'
  | 'export'
  | 'dynamic-import'
  | 'require'
  | 'python-import'
  | 'python-from'
  | 'go-import';

export interface ImportReference {
  specifier: string;
  line: number;
  kind: ImportKind;
}

export interface SourceFile {
  id: string;
  absolutePath: string;
  language: Language;
  extension: string;
  content: string;
  loc: number;
  bytes: number;
}

export interface GraphNode {
  id: string;
  language: Language;
  extension: string;
  loc: number;
  bytes: number;
  inDegree: number;
  outDegree: number;
  hotspotScore: number;
  cycleIds: number[];
}

export interface GraphEdge {
  source: string;
  target: string;
  specifier: string;
  line: number;
  kind: ImportKind;
}

export interface UnresolvedImport {
  source: string;
  specifier: string;
  line: number;
  kind: ImportKind;
  classification: 'external' | 'unresolved-local';
}

export interface Cycle {
  id: number;
  nodes: string[];
  size: number;
}

export interface Hotspot {
  id: string;
  score: number;
  inDegree: number;
  outDegree: number;
  loc: number;
  reasons: string[];
}

export interface AnalysisSummary {
  files: number;
  dependencies: number;
  externalImports: number;
  unresolvedLocalImports: number;
  cycles: number;
  languages: Partial<Record<Language, number>>;
  totalLoc: number;
}

export interface AnalysisMeta {
  schemaVersion: 1;
  tool: 'archlens';
  version: string;
  rootName: string;
  generatedAt: string;
  durationMs: number;
}

export interface ImpactNode {
  id: string;
  distance: number;
  changedFile: string;
  witnessPath: string[];
  /** Present only when the complete witness was omitted by a safety limit. */
  witnessPathOmitted?: true;
}

export interface ImpactWitnessSummary {
  maxNodesPerPath: number;
  maxTotalNodes: number;
  materializedNodes: number;
  omittedPaths: number;
}

export interface ChangeImpact {
  requested: string[];
  seeds: string[];
  unmatched: string[];
  affectedFiles: number;
  maxDistance: number;
  nodes: ImpactNode[];
  /** Materialization limits and their effect on this result. */
  witnesses?: ImpactWitnessSummary;
}

export interface AnalysisResult {
  meta: AnalysisMeta;
  summary: AnalysisSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  unresolvedImports: UnresolvedImport[];
  cycles: Cycle[];
  hotspots: Hotspot[];
  warnings: string[];
  impact?: ChangeImpact;
}

export interface ScanOptions {
  root: string;
  useGitignore: boolean;
  include: string[];
  exclude: string[];
  maxFiles: number;
}

export interface ScanResult {
  files: SourceFile[];
  warnings: string[];
}

export interface AnalyzeOptions extends Partial<Omit<ScanOptions, 'root'>> {
  root: string;
  impact?: string[];
}
