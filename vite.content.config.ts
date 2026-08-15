import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function asciiEscape(code: number): string {
  if (code <= 0xffff) return '\\u' + code.toString(16).padStart(4, '0');
  const hi = 0xd800 + ((code - 0x10000) >> 10);
  const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
  return '\\u' + hi.toString(16) + '\\u' + lo.toString(16);
}

/**
 * The content script gets its own build because Chrome injects it as a classic
 * script: ES module syntax (import/export) is not allowed, so everything must
 * be inlined into a single self-executing bundle.
 */
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  // Chrome refuses to load content scripts it does not detect as UTF-8; its
  // encoding heuristic chokes on bundles containing literal multibyte
  // characters (e.g. CJK punctuation inlined from dependencies). Emit only
  // ASCII by escaping everything else to \uXXXX.
  esbuild: { charset: 'ascii' },
  plugins: [
    {
      name: 'ascii-content-script',
      closeBundle: async () => {
        const file = resolve(__dirname, 'dist/content.js');
        const source = await readFile(file, 'utf8');
        let out = '';
        for (const ch of source) {
          const code = ch.codePointAt(0)!;
          out += code > 127 ? asciiEscape(code) : ch;
        }
        await writeFile(file, out);
      },
    },
  ],
  // NOTE: `define` must be a TOP-LEVEL Vite option, not nested under `build`.
  // The content bundle pulls in React/ReactDOM (via hover-card.ts), which read
  // `process.env.NODE_ENV` at runtime. In a browser content script there is no
  // Node `process`, so leaving it undefined throws
  // "Uncaught ReferenceError: process is not defined" the moment a React path
  // (e.g. the bilingual reader's hover card) mounts. The main app build gets
  // this replacement for free from @vitejs/plugin-react; this separate config
  // has no such plugin, so we must define it explicitly here.
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      mode === 'development' ? 'development' : 'production',
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    target: 'chrome110',
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'VocabContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { extend: true, inlineDynamicImports: true },
    },
  },
}));
