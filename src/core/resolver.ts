import path from 'node:path';
import type { ImportReference, SourceFile } from '../types.js';
import { toPosix } from './paths.js';

const JS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export interface ResolutionContext {
  files: readonly SourceFile[];
  byId: ReadonlyMap<string, SourceFile>;
  goModule?: string;
}

export interface Resolution {
  target?: string;
  classification: 'resolved' | 'external' | 'unresolved-local';
}

function normalizeId(value: string): string {
  return toPosix(path.posix.normalize(value)).replace(/^\.\//, '');
}

function firstExisting(candidates: readonly string[], context: ResolutionContext): string | undefined {
  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);
    if (context.byId.has(normalized)) return normalized;
  }
  return undefined;
}

function resolveJavaScript(source: SourceFile, specifier: string, context: ResolutionContext): Resolution {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return { classification: 'external' };
  const clean = specifier.split(/[?#]/)[0] ?? specifier;
  const base = specifier.startsWith('/')
    ? clean.slice(1)
    : path.posix.join(path.posix.dirname(source.id), clean);
  const extension = path.posix.extname(base);
  const candidates = [base];
  if (!extension) {
    for (const item of JS_EXTENSIONS) candidates.push(`${base}${item}`);
    for (const item of JS_EXTENSIONS) candidates.push(path.posix.join(base, `index${item}`));
  } else if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    const stem = base.slice(0, -extension.length);
    for (const item of ['.ts', '.tsx', '.mts', '.cts']) candidates.push(`${stem}${item}`);
  }
  const target = firstExisting(candidates, context);
  return target ? { target, classification: 'resolved' } : { classification: 'unresolved-local' };
}

function pythonCandidates(base: string): string[] {
  return [`${base}.py`, path.posix.join(base, '__init__.py')];
}

function resolvePython(source: SourceFile, specifier: string, context: ResolutionContext): Resolution {
  const relativeMatch = specifier.match(/^(\.+)(.*)$/);
  if (relativeMatch?.[1] !== undefined) {
    let baseDirectory = path.posix.dirname(source.id);
    for (let level = 1; level < relativeMatch[1].length; level += 1) {
      baseDirectory = path.posix.dirname(baseDirectory);
    }
    const modulePath = (relativeMatch[2] ?? '').replaceAll('.', '/');
    const base = path.posix.join(baseDirectory, modulePath);
    const target = firstExisting(pythonCandidates(base), context);
    return target ? { target, classification: 'resolved' } : { classification: 'unresolved-local' };
  }
  const modulePath = specifier.replaceAll('.', '/');
  const localBase = path.posix.join(path.posix.dirname(source.id), modulePath);
  const target = firstExisting([...pythonCandidates(modulePath), ...pythonCandidates(localBase)], context);
  return target ? { target, classification: 'resolved' } : { classification: 'external' };
}

function resolveGo(source: SourceFile, specifier: string, context: ResolutionContext): Resolution {
  let packageDirectory: string | undefined;
  let local = false;
  if (context.goModule && (specifier === context.goModule || specifier.startsWith(`${context.goModule}/`))) {
    packageDirectory = specifier.slice(context.goModule.length).replace(/^\//, '');
    local = true;
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    packageDirectory = normalizeId(path.posix.join(path.posix.dirname(source.id), specifier));
    local = true;
  }
  if (packageDirectory === undefined) return { classification: 'external' };
  const prefix = packageDirectory ? `${packageDirectory}/` : '';
  const candidates = context.files
    .filter((file) => file.language === 'go' && file.id.startsWith(prefix) && !file.id.slice(prefix.length).includes('/'))
    .sort((left, right) => Number(left.id.endsWith('_test.go')) - Number(right.id.endsWith('_test.go')) || left.id.localeCompare(right.id));
  const target = candidates[0]?.id;
  return target ? { target, classification: 'resolved' } : { classification: local ? 'unresolved-local' : 'external' };
}

export function resolveImport(
  source: SourceFile,
  reference: ImportReference,
  context: ResolutionContext,
): Resolution {
  if (source.language === 'python') return resolvePython(source, reference.specifier, context);
  if (source.language === 'go') return resolveGo(source, reference.specifier, context);
  return resolveJavaScript(source, reference.specifier, context);
}
