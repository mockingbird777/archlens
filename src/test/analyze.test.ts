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
  const escapedPageTitle = 'Fixture &lt;/title&gt;&lt;script&gt;bad()&lt;/script&gt; · ArchLens';
  const description = 'Interactive, local-first repository intelligence for dependencies, cycles, and change-risk hotspots.';
  assert.ok(html.includes(`<meta name="description" content="${description}">`));
  assert.ok(html.includes('<meta property="og:type" content="website">'));
  assert.ok(html.includes(`<meta property="og:title" content="${escapedPageTitle}">`));
  assert.ok(html.includes(`<meta property="og:description" content="${description}">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary">'));
  assert.ok(html.includes(`<meta name="twitter:title" content="${escapedPageTitle}">`));
  assert.ok(html.includes(`<meta name="twitter:description" content="${description}">`));
  assert.doesNotMatch(html, /(?:property|name)="og:image"/);
  assert.match(html, /application\/json/);
  assert.match(html, /Local-first/);
  assert.match(
    html,
    /<a href="https:\/\/github\.com\/mockingbird777\/archlens" target="_blank" rel="noopener noreferrer">Explore ArchLens on GitHub ↗<\/a>/,
  );
  assert.doesNotMatch(html, /<script>globalThis\.compromised/);
  assert.match(html, /\\u003c\/script\\u003e/);
  assert.doesNotMatch(html, new RegExp(fixture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<(?:img|link|iframe)[^>]+(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(html, /(?:fetch\s*\(|XMLHttpRequest|sendBeacon)/);
  assert.match(mermaid, /flowchart LR/);
  assert.match(mermaid, /src\/a\.ts/);
});

test('hotspot and cycle rows render as keyboard-operable buttons', async () => {
  const result = await analyzeRepository({ root: fixture });
  const html = renderHtml(result, 'Fixture');
  // Rows are native buttons (click = Enter/Space for keyboards) with an
  // accessible name carrying the path + score, or the cycle size.
  assert.match(html, /<button type="button" class="row" data-node="'\+escapeText\(h\.id\)\+'" aria-label="Select hotspot '\+escapeText\(h\.id\)\+', score '\+escapeText\(h\.score\)\+'"/);
  assert.match(html, /<button type="button" class="row" data-node="'\+escapeText\(c\.nodes\[0\]\|\|''\)\+'" aria-label="Select cycle of '\+escapeText\(c\.size\)\+' files:/);
  assert.doesNotMatch(html, /<div class="row"/);
  // Visible focus style ships with the report.
  assert.match(html, /\.row:focus-visible\{outline:2px solid var\(--accent\)/);
});
