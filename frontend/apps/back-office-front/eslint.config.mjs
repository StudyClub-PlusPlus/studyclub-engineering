import nextConfig from '@studyclub/eslint-config/next';

export default [...nextConfig, { ignores: ['playwright-report/**', 'test-results/**'] }];
