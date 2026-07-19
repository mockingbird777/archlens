import type { ImportReference } from '../types.js';
import { lineNumberAt } from '../core/paths.js';

interface MaskedSource {
  clean: string;
  codePositions: Uint8Array;
}

function blankGoComments(source: string): MaskedSource {
  let result = '';
  const codePositions = new Uint8Array(source.length);
  let state: 'code' | 'line-comment' | 'block-comment' | 'double' | 'raw' | 'rune' = 'code';
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
        if (character === '"') state = 'double';
        else if (character === '`') state = 'raw';
        else if (character === "'") state = 'rune';
      }
      continue;
    }
    result += character;
    if (state === 'raw') {
      if (character === '`') state = 'code';
    } else if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if ((state === 'double' && character === '"') || (state === 'rune' && character === "'")) {
      state = 'code';
    }
  }
  return { clean: result, codePositions };
}

export function parseGoImports(source: string): ImportReference[] {
  const { clean, codePositions } = blankGoComments(source);
  const references: ImportReference[] = [];
  const importExpression = /\bimport\s*(?:\(([\s\S]*?)\)|(?:[\w.]+\s+)?(["`])([^"`]+)\2)/g;
  for (const match of clean.matchAll(importExpression)) {
    if (match.index === undefined || codePositions[match.index] !== 1) continue;
    if (match[3]) {
      references.push({ specifier: match[3], line: lineNumberAt(clean, match.index), kind: 'go-import' });
      continue;
    }
    const block = match[1] ?? '';
    const blockStart = match.index + (match[0]?.indexOf(block) ?? 0);
    const quoted = /(?:[\w.]+\s+)?(["`])([^"`]+)\1/g;
    for (const nested of block.matchAll(quoted)) {
      if (nested.index === undefined || !nested[2]) continue;
      references.push({
        specifier: nested[2],
        line: lineNumberAt(clean, blockStart + nested.index),
        kind: 'go-import',
      });
    }
  }
  return references.sort((left, right) => left.line - right.line || left.specifier.localeCompare(right.specifier));
}
