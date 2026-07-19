import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGoImports } from '../analyzers/go.js';
import { parseJavaScriptImports } from '../analyzers/javascript.js';
import { parsePythonImports } from '../analyzers/python.js';

test('JavaScript parser finds static, dynamic, export, and require imports', () => {
  const imports = parseJavaScriptImports(`
    import value from './value.js';
    import * as helpers from './helpers.js';
    import './side-effect.js';
    export { thing } from './thing.js';
    const lazy = import('./lazy.js');
    const old = require('./old.cjs');
    // import ignored from './comment.js';
  `);
  assert.deepEqual(imports.map((item) => item.specifier), [
    './value.js', './helpers.js', './side-effect.js', './thing.js', './lazy.js', './old.cjs',
  ]);
});

test('JavaScript parser ignores import-like text inside strings and templates', () => {
  const imports = parseJavaScriptImports(`
    const example = "import fake from './fake.js'";
    const template = \`require('./also-fake.js')\`;
    import real from './real.js';
  `);
  assert.deepEqual(imports.map((item) => item.specifier), ['./real.js']);
});

test('Python parser handles absolute, aliased, and relative imports', () => {
  const imports = parsePythonImports(`
import json, pathlib as paths
from . import worker
from package.tools import build
  `);
  assert.deepEqual(imports.map((item) => item.specifier), ['json', 'pathlib', '.worker', 'package.tools']);
});

test('Python parser ignores imports in comments, strings, and docstrings', () => {
  const imports = parsePythonImports(`
"""
import fake
"""
value = "from fake import value"
# import also_fake
import real
  `);
  assert.deepEqual(imports.map((item) => item.specifier), ['real']);
  assert.equal(imports[0]?.line, 7);
});

test('Go parser handles grouped and aliased imports', () => {
  const imports = parseGoImports(`package sample
import (
  "fmt"
  alias "example.com/team/tool"
)
import _ "embed"
`);
  assert.deepEqual(imports.map((item) => item.specifier), ['fmt', 'example.com/team/tool', 'embed']);
  assert.deepEqual(imports.map((item) => item.line), [3, 4, 6]);
});

test('Go parser ignores import-like text inside interpreted and raw strings', () => {
  const imports = parseGoImports(`package sample
var one = "import fake \\"example.com/fake\\""
var two = \`import "example.com/also-fake"\`
import "example.com/real"
`);
  assert.deepEqual(imports.map((item) => item.specifier), ['example.com/real']);
  assert.equal(imports[0]?.line, 4);
});
