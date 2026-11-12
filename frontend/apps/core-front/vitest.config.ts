import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // tsconfig paths 의 '@/*' 와 같게 — '@/' 로 다른 모듈을 부르는 lib 도 테스트할 수 있게
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // e2e/ 는 Playwright 소관이다. vitest 가 같이 수집하면 `test.describe` 가
    // Playwright 러너 밖에서 실행돼 `npm test` 가 항상 빨갛게 뜬다.
    // configDefaults 를 펼쳐야 node_modules·dist 제외가 유지된다 — exclude 는 덮어쓰기다.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
