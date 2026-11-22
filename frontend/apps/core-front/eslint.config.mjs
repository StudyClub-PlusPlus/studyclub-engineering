import nextConfig from '@studyclub/eslint-config/next';

export default [
  ...nextConfig,
  { ignores: ['test-results/**', 'playwright-report/**'] },
];
