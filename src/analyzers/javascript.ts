import type { ImportKind, ImportReference } from '../types.js';
import { lineNumberAt } from '../core/paths.js';

interface MaskedSource {
  clean: string;
  codePositions: Uint8Array;
}

function blankComments(source: string): MaskedSource {
  let result = '';
  const codePositions = new Uint8Array(source.length);
  let state: 'code' | 'single' | 'double' | 'template' | 'line-comment' | 'block-comment' = 'code';
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    const next = source[index + 1] ?? '';
    if (state === 'line-comment') {
      if (character === '\n') {
        state = 'code';
        result += '\n';
      } else result += ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        result += '  ';
        index += 1;
        state = 'code';
      } else result += character === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'code') {
      codePositions[index] = 1;
      if (character === '/' && next === '/') {
        result += '  ';
        index += 1;
        state = 'line-comment';
      } else if (character === '/' && next === '*') {
        result += '  ';
        index += 1;
        state = 'block-comment';
      } else {
        result += character;
        if (character === "'") state = 'single';
        else if (character === '"') state = 'double';
        else if (character === '`') state = 'template';
      }
      continue;
    }
    result += character;
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (
      (state === 'single' && character === "'")
      || (state === 'double' && character === '"')
      || (state === 'template' && character === '`')
    ) {
      state = 'code';
    }
  }
  return { clean: result, codePositions };
}

function collect(
  source: string,
  expression: RegExp,
  kind: ImportKind,
  specifierGroup: number,
  codePositions: Uint8Array,
): ImportReference[] {
  const references: ImportReference[] = [];
  for (const match of source.matchAll(expression)) {
    const specifier = match[specifierGroup];
    if (!specifier || match.index === undefined || codePositions[match.index] !== 1) continue;
    references.push({ specifier, line: lineNumberAt(source, match.index), kind });
  }
  return references;
}

export function parseJavaScriptImports(source: string): ImportReference[] {
  const { clean, codePositions } = blankComments(source);
  const references = [
    ...collect(clean, /\bimport\s+(?!\s*\()(?:type\s+)?(?:[\w*$]+|\{[^}]*\})(?:\s*,\s*\{[^}]*\})?\s+from\s+(['"])([^'"]+)\1/g, 'import', 2, codePositions),
    ...collect(clean, /\bimport\s+(?!\s*\()(?:type\s+)?(?:[\w$]+\s*,\s*)?\*\s+as\s+[\w$]+\s+from\s+(['"])([^'"]+)\1/g, 'import', 2, codePositions),
    ...collect(clean, /\bimport\s+(?!\s*\()(['"])([^'"]+)\1/g, 'import', 2, codePositions),
    ...collect(clean, /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+(['"])([^'"]+)\1/g, 'export', 2, codePositions),
    ...collect(clean, /\bimport\s*\(\s*(['"])([^'"]+)\1/g, 'dynamic-import', 2, codePositions),
    ...collect(clean, /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g, 'require', 2, codePositions),
  ];
  const unique = new Map<string, ImportReference>();
  for (const reference of references) {
    unique.set(`${reference.line}:${reference.kind}:${reference.specifier}`, reference);
  }
  return [...unique.values()].sort((left, right) => left.line - right.line || left.specifier.localeCompare(right.specifier));
}
