import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeRepository } from '../core/analyze.js';
import { renderHtml } from '../reporters/html.js';
import { renderMermaid } from '../reporters/mermaid.js';

const fixture = fileURLToPath(new URL('../../test/fixtures/polyglot', import.meta.url));

test('analyzes a polyglot repository and respects .gitignore', async () => {
  const result = await analyzeRepository({ root: fixture });
  assert.equal(result.summary.files, 7);
  assert.equal(result.nodes.some((node) => node.id === 'ignored.py'), false);
  assert.ok(result.edges.some((edge) => edge.source === 'src/a.ts' && edge.target === 'src/b.ts'));
  assert.ok(result.edges.some((edge) => edge.source === 'pkg/app/main.go' && edge.target === 'pkg/util/tool.go'));
  assert.ok(result.unresolvedImports.some((item) => item.specifier === 'left-pad' && item.classification === 'external'));
  assert.ok(result.cycles.some((cycle) => cycle.nodes.includes('src/a.ts') && cycle.nodes.includes('src/b.ts')));
  assert.ok(result.cycles.some((cycle) => cycle.nodes.includes('pyutil/__init__.py') && cycle.nodes.includes('pyutil/worker.py')));
});

test('reporters create portable, useful output', async () => {
  const result = await analyzeRepository({ root: fixture });
  result.warnings.push('</script><script>globalThis.compromised = true</script>');
  const html = renderHtml(result, 'Fixture </title><script>bad()</script>');
  const mermaid = renderMermaid(result);
  assert.match(html, /Fixture &lt;\/title&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /application\/json/);
  assert.match(html, /Local-first/);
  assert.doesNotMatch(html, /<script>globalThis\.compromised/);
  assert.match(html, /\\u003c\/script\\u003e/);
  assert.doesNotMatch(html, new RegExp(fixture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(mermaid, /flowchart LR/);
  assert.match(mermaid, /src\/a\.ts/);
});
