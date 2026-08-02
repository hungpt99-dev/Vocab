import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The content script gets its own build because Chrome injects it as a classic
 * script: ES module syntax (import/export) is not allowed, so everything must
 * be inlined into a single self-executing bundle.
 */
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    target: 'chrome110',
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'AiVocabularySaverContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { extend: true, inlineDynamicImports: true },
    },
  },
});
