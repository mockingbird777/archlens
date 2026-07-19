#!/usr/bin/env node
import('../dist/cli.js').then(({ run }) => run(process.argv.slice(2))).catch((error) => {
  console.error(`archlens: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
