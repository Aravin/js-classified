import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],

    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
    rules: {
      // These rules produce too many false positives in this Svelte 4 codebase
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/infinite-reactive-loop': 'warn',
    },
  },
  {
    // Relax explicit-any in test files
    files: ['**/*.test.ts', '**/*.spec.ts', '**/vitest-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/'],
  },
);
