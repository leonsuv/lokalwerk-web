import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { networkAndStorageRules } from './eslint.restrictions.js';

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'prototype/', 'vendor/', 'tests/fixtures/']),
  {
    files: ['**/*.{ts,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Ausgelieferter Code: Browser und Worker.
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    rules: networkAndStorageRules,
  },
  {
    files: ['build/**', 'scripts/**', 'tests/**', '*.config.{ts,js}', 'eslint.*.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
