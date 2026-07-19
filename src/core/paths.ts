import path from 'node:path';

export function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

export function relativeId(root: string, absolutePath: string): string {
  return toPosix(path.relative(root, absolutePath));
}

export function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function lineNumberAt(source: string, index: number): number {
  let lines = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) lines += 1;
  }
  return lines;
}

export function countLines(content: string): number {
  if (content.length === 0) return 0;
  const matches = content.match(/\r\n|\r|\n/g);
  const breaks = matches?.length ?? 0;
  return breaks + (/(?:\r\n|\r|\n)$/.test(content) ? 0 : 1);
}
