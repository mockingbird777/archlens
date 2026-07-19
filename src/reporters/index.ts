import type { AnalysisResult } from '../types.js';
import { renderHtml } from './html.js';
import { renderJson } from './json.js';
import { renderMermaid } from './mermaid.js';

export type ReportFormat = 'html' | 'json' | 'mermaid';

export function renderReport(result: AnalysisResult, format: ReportFormat, title?: string): string {
  switch (format) {
    case 'html': return renderHtml(result, title);
    case 'json': return renderJson(result);
    case 'mermaid': return renderMermaid(result);
  }
}

export { renderHtml, renderJson, renderMermaid };
