import pluginNext from '@next/eslint-plugin-next';

import { config as baseConfig } from './base.js';

/** @type {import('eslint').Linter.Config} */
export default [
  ...baseConfig,
  {
    plugins: { '@next/next': pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
    },
  },
];
