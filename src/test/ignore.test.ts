import assert from 'node:assert/strict';
import test from 'node:test';
import { isIgnored, matchesGlob, parseGitignore } from '../core/ignore.js';

test('glob matching supports recursive and basename patterns', () => {
  assert.equal(matchesGlob('packages/api/src/main.test.ts', '**/*.test.ts'), true);
  assert.equal(matchesGlob('packages/api/src/main.ts', 'packages/**'), true);
  assert.equal(matchesGlob('src/generated.ts', '*.generated.ts'), false);
});

test('.gitignore rules support directories, anchoring, and negation', () => {
  const rules = parseGitignore(`
dist/
*.generated.ts
!important.generated.ts
/src/private/**
`, '');
  assert.equal(isIgnored('dist', true, rules, []), true);
  assert.equal(isIgnored('nested/code.generated.ts', false, rules, []), true);
  assert.equal(isIgnored('important.generated.ts', false, rules, []), false);
  assert.equal(isIgnored('src/private/key.ts', false, rules, []), true);
  assert.equal(isIgnored('lib/src/private/key.ts', false, rules, []), false);
});

test('gitignore negation cannot re-include hard-skipped dependency directories', () => {
  const rules = parseGitignore('!node_modules/\n!dist/', '');
  assert.equal(isIgnored('node_modules', true, rules, []), true);
  assert.equal(isIgnored('dist', true, rules, []), true);
});
