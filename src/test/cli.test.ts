import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCliArgs } from '../cli.js';

test('CLI parser accepts repeatable filters and explicit output', () => {
  const options = parseCliArgs([
    './project', '--format', 'json', '--output', 'result.json',
    '--include', 'src/**', '--exclude', '**/*.test.ts', '--max-files', '500',
  ]);
  assert.equal(options.root, './project');
  assert.equal(options.format, 'json');
  assert.equal(options.output, 'result.json');
  assert.deepEqual(options.include, ['src/**']);
  assert.deepEqual(options.exclude, ['**/*.test.ts']);
  assert.equal(options.maxFiles, 500);
  assert.equal(options.open, false);
});

test('CLI parser returns friendly errors for invalid input', () => {
  assert.throws(() => parseCliArgs(['--format', 'xml']), /Choose html, json, or mermaid/);
  assert.throws(() => parseCliArgs(['--max-files', '0']), /positive integer/);
  assert.throws(() => parseCliArgs(['one', 'two']), /Only one repository path/);
  assert.throws(() => parseCliArgs(['--stdout', '--output', 'report.json']), /cannot be combined/);
  assert.throws(() => parseCliArgs(['--open', '--stdout']), /cannot be used/);
  assert.throws(() => parseCliArgs(['--open', '--format', 'json']), /only available for HTML/);
});

test('CLI parser treats --output - as stdout', () => {
  const options = parseCliArgs(['.', '--output', '-']);
  assert.equal(options.output, '-');
});

test('CLI parser supports opening a generated HTML report', () => {
  const options = parseCliArgs(['./project', '--open']);
  assert.equal(options.open, true);
  assert.equal(options.format, 'html');
});
