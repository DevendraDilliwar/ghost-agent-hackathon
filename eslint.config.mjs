import { builtinModules } from 'node:module';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const layers = ['main', 'preload', 'renderer', 'agent', 'desktop', 'providers', 'policy', 'observability', 'shared'];
const nodeImports = [...new Set(builtinModules.flatMap((name) => [name, 'node:' + name]))];

function restrictLayers(allowed, allowNode = false, allowElectron = false) {
  return ['error', {
    paths: allowNode ? [] : [...nodeImports, ...(allowElectron ? [] : ['electron'])],
    patterns: layers
      .filter((layer) => !allowed.includes(layer))
      .map((layer) => ({
        regex: '^(?:[.]{2}/)+' + layer + '(?:/|$)',
        message: 'Keep this module inside its documented dependency boundary.',
      })),
  }];
}

export default defineConfig(
  globalIgnores(['node_modules/**', 'out/**', 'release/**', 'coverage/**', '.agents/**', '.codex/**', '.aws/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, process: 'off', Buffer: 'off' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': restrictLayers(['renderer', 'shared']),
    },
  },
  {
    files: ['src/preload/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['preload', 'shared'], false, true) },
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictLayers(
        ['main', 'agent', 'desktop', 'providers', 'policy', 'observability', 'shared'],
        true,
      ),
    },
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['shared']) },
  },
  {
    files: ['src/agent/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['agent', 'shared']) },
  },
  {
    files: ['src/policy/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['policy', 'shared']) },
  },
  {
    files: ['src/desktop/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['desktop', 'agent', 'shared', 'observability'], true) },
  },
  {
    files: ['src/providers/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['providers', 'agent', 'shared', 'policy', 'observability'], true) },
  },
  {
    files: ['src/observability/**/*.ts'],
    rules: { 'no-restricted-imports': restrictLayers(['observability', 'shared'], true) },
  },
);
