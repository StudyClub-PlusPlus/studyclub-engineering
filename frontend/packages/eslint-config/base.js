import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import importPlugin from 'eslint-plugin-import';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';
import pluginReactHooks from 'eslint-plugin-react-hooks';

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: { ...globals.serviceworker },
    },
  },
  {
    plugins: { 'react-hooks': pluginReactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    plugins: {
      turbo: turboPlugin,
      import: importPlugin,
      onlyWarn,
    },
  },
  {
    rules: {
      'import/extensions': 'off',
      'no-undef': 'off',
      'react/react-in-jsx-scope': 'off',
      'turbo/no-undeclared-env-vars': 'warn',
      'no-use-before-define': [
        'error',
        { functions: false, classes: true, variables: false, allowNamedExports: false },
      ],
      'react/jsx-filename-extension': [2, { extensions: ['.js', '.jsx', '.ts', '.tsx'] }],
      'react/function-component-definition': [
        'error',
        { namedComponents: ['arrow-function', 'function-declaration'] },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        { devDependencies: true, peerDependencies: true },
      ],
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: [
            ['builtin', 'external'],
            ['internal', 'parent', 'sibling', 'index'],
          ],
          pathGroups: [
            { pattern: 'react', group: 'builtin', position: 'before' },
            { pattern: 'next/*', group: 'external', position: 'before' },
            { pattern: '@/**', group: 'internal' },
          ],
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
    },
  },
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '.next/**/*', '.github/**/*'],
  },
];
