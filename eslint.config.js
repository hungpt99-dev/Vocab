import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules', 'shot.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.webextensions, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TypeScript performs its own (more accurate) undefined-symbol analysis,
      // and the core rule cannot see ambient types such as `chrome`.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**', 'scripts/**'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Playwright fixtures take a callback named `use`, which the React hooks
    // rule misreads as a hook call.
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      // Playwright's fixture signature requires the `{}` first parameter.
      'no-empty-pattern': 'off',
    },
  },
  {
    // Manual selftest scripts: Node scripts that embed browser-context closures
    // (`document`, `URL`, `chrome` inside page.evaluate), so both global sets
    // are legitimately in scope.
    files: ['e2e/selftest-*.mjs', 'scripts/*.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.webextensions } },
  },
);
