import type { AnalysisResult } from '../types.js';

export function renderJson(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
