import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The content script gets its own build because Chrome injects it as a classic
 * script: ES module syntax (import/export) is not allowed, so everything must
 * be inlined into a single self-executing bundle.
 */
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
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
