import type { ImportReference } from '../types.js';

function blankStringsAndComments(source: string): string {
  let result = '';
  let quote: "'" | '"' | undefined;
  let triple = false;
  let comment = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (comment) {
      if (character === '\n' || character === '\r') {
        comment = false;
        result += character;
      } else result += ' ';
      continue;
    }
    if (!quote) {
      if (character === '#') {
        comment = true;
        result += ' ';
      } else if (character === "'" || character === '"') {
        quote = character;
        triple = source.slice(index, index + 3) === character.repeat(3);
        const width = triple ? 3 : 1;
        result += ' '.repeat(width);
        index += width - 1;
      } else result += character;
      continue;
    }
    if (triple && source.slice(index, index + 3) === quote.repeat(3)) {
      result += '   ';
      index += 2;
      quote = undefined;
      triple = false;
      escaped = false;
      continue;
    }
    result += character === '\n' || character === '\r' ? character : ' ';
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (!triple && character === quote) quote = undefined;
  }
  return result;
}

function importedNames(value: string): string[] {
  return value
    .replace(/[()]/g, '')
    .split(',')
    .map((part) => part.trim().split(/\s+as\s+/)[0] ?? '')
    .filter(Boolean);
}

export function parsePythonImports(source: string): ImportReference[] {
  const references: ImportReference[] = [];
  const lines = blankStringsAndComments(source).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fromMatch = line.match(/^\s*from\s+([.\w]+)\s+import\s+(.+)$/);
    if (fromMatch?.[1] && fromMatch[2]) {
      const moduleName = fromMatch[1];
      if (/^\.+$/.test(moduleName)) {
        for (const name of importedNames(fromMatch[2])) {
          references.push({ specifier: `${moduleName}${name}`, line: index + 1, kind: 'python-from' });
        }
      } else {
        references.push({ specifier: moduleName, line: index + 1, kind: 'python-from' });
      }
      continue;
    }
    const importMatch = line.match(/^\s*import\s+(.+)$/);
    if (importMatch?.[1]) {
      for (const moduleName of importedNames(importMatch[1])) {
        references.push({ specifier: moduleName, line: index + 1, kind: 'python-import' });
      }
    }
  }
  return references;
}
