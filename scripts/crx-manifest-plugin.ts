import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { buildManifest } from './manifest';

/**
 * Emits a Manifest V3 manifest.json into the build output and rewrites the
 * generated popup/options HTML paths so Chrome can resolve them from the
 * extension root.
 */
export function crxManifest(): Plugin {
  return {
    name: 'crx-manifest',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        `${JSON.stringify(buildManifest(), null, 2)}\n`,
        'utf8',
      );
    },
  };
}
