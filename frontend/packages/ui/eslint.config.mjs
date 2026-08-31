import { config } from '@studyclub/eslint-config/base';

export default [
  ...config,
  {
    ignores: ['**/*.stories.tsx'],
  },
];
