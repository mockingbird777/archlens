import type { ImportReference, SourceFile } from '../types.js';
import { parseGoImports } from './go.js';
import { parseJavaScriptImports } from './javascript.js';
import { parsePythonImports } from './python.js';

export function parseImports(file: SourceFile): ImportReference[] {
  switch (file.language) {
    case 'javascript':
    case 'typescript':
      return parseJavaScriptImports(file.content);
    case 'python':
      return parsePythonImports(file.content);
    case 'go':
      return parseGoImports(file.content);
  }
}
