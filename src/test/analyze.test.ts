import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

test('adds an explicit change-impact layer without reading source into the report', async () => {
  const result = await analyzeRepository({ root: fixture, impact: ['src/b.ts', 'does-not-exist.ts'] });
  assert.deepEqual(result.impact?.seeds, ['src/b.ts']);
  assert.deepEqual(result.impact?.unmatched, ['does-not-exist.ts']);
  assert.ok(result.impact?.nodes.some((node) => node.id === 'src/a.ts' && node.distance === 1));
  assert.ok(result.warnings.some((warning) => warning.includes('does-not-exist.ts')));
  const html = renderHtml(result, 'Impact fixture');
  const mermaid = renderMermaid(result);
  assert.match(html, /Potential change impact/);
  assert.match(html, /Impact only/);
  assert.match(html, /potentially affected/);
  assert.match(mermaid, /Potential change impact:/);
  assert.match(mermaid, /impactSeed/);
  assert.match(mermaid, /impactAffected/);
});

test('reporters create portable, useful output', async () => {
  const result = await analyzeRepository({ root: fixture });
  result.warnings.push('</script><script>globalThis.compromised = true</script>');
  const html = renderHtml(result, 'Fixture </title><script>bad()</script>');
  const mermaid = renderMermaid(result);
  assert.match(html, /Fixture &lt;\/title&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  const escapedPageTitle = 'Fixture &lt;/title&gt;&lt;script&gt;bad()&lt;/script&gt; · ArchLens';
  const description = 'Interactive, local-first repository intelligence for dependencies, cycles, change-risk hotspots, and blast radius.';
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
  assert.match(html, /Analysis warnings/);
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;globalThis\.compromised = true&lt;\/script&gt;/);
  assert.doesNotMatch(html, new RegExp(fixture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<(?:img|link|iframe)[^>]+(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(html, /(?:fetch\s*\(|XMLHttpRequest|sendBeacon)/);
  assert.match(mermaid, /flowchart LR/);
  assert.match(mermaid, /src\/a\.ts/);
});

test('Mermaid keeps untrusted paths and specifiers on inert terminal lines', async () => {
  const result = await analyzeRepository({ root: fixture });
  const node = result.nodes[0];
  const graphEdge = result.edges[0];
  assert.ok(node);
  assert.ok(graphEdge);
  const originalId = node.id;
  const osc = '\u001b]52;c;Y29weQ==\u0007';
  node.id = `unsafe/${osc}\u009d0;title\u009c\r\ninjected.ts`;
  for (const candidate of result.edges) {
    if (candidate.source === originalId) candidate.source = node.id;
    if (candidate.target === originalId) candidate.target = node.id;
  }
  graphEdge.specifier = `./dependency${osc}\u001b[31m\u009b32m\nnext`;

  const mermaid = renderMermaid(result);
  assert.doesNotMatch(mermaid, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
  assert.doesNotMatch(mermaid, /\u001b|\u0007|\u009b|\u009d/);
  assert.match(mermaid, /injected\.ts/);
  assert.match(mermaid, /dependency/);
});

test('records an explicit warning when impact witness paths are omitted', async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archlens-witness-limit-'));
  try {
    const fileIds = Array.from({ length: 258 }, (_, index) => `n${String(index).padStart(3, '0')}.ts`);
    await Promise.all(fileIds.map((id, index) => {
      const previous = fileIds[index - 1];
      const content = previous
        ? `import './${previous.replace(/\.ts$/, '.js')}';\nexport const value${index} = ${index};\n`
        : 'export const value0 = 0;\n';
      return fs.writeFile(path.join(temporaryRoot, id), content, 'utf8');
    }));

    const result = await analyzeRepository({
      root: temporaryRoot,
      impact: [fileIds[0] ?? ''],
      useGitignore: false,
      maxFiles: 300,
    });
    assert.equal(result.impact?.affectedFiles, 257);
    assert.equal(result.impact?.maxDistance, 257);
    assert.equal(result.impact?.witnesses?.omittedPaths, 2);
    assert.ok(result.warnings.some((warning) => (
      warning.includes('Impact witness paths were omitted for 2 node(s)')
      && warning.includes('Distances, changed-file origins, and affected-file counts remain complete.')
    )));
    assert.ok(result.impact?.nodes.some((impactNode) => (
      impactNode.distance === 256
      && impactNode.witnessPathOmitted === true
      && impactNode.witnessPath.length === 0
    )));
    const html = renderHtml(result, 'Witness limit fixture');
    assert.match(html, /Analysis warnings/);
    assert.match(html, /Impact witness paths were omitted for 2 node\(s\)/);
    assert.match(html, /Omitted by report safety limit/);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
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
