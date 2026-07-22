/** Replace terminal controls so untrusted values remain on one inert line. */
export function sanitizeTerminalLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}
