import { expect, test, type BrowserContext } from '@playwright/test';

const apps = [
  {
    name: '사용자 사이트',
    prefix: 'sc',
    origin: 'http://localhost:4890',
    path: '/ko/my?tab=profile',
    heading: '마이페이지',
    login: '/ko/login',
  },
  {
    name: '백오피스',
    prefix: 'bo',
    origin: 'http://localhost:4891',
    path: '/studies?keyword=refresh',
    heading: '스터디 관리',
    login: '/login',
  },
];

async function refreshCookie(context: BrowserContext, prefix: string, value: string) {
  await context.addCookies([
    {
      name: `${prefix}_stage_refresh_token`,
      value,
      domain: 'localhost',
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Date.now() / 1000 + 30 * 86400,
    },
  ]);
}

for (const app of apps) {
  test.describe(app.name, () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(({ prefix }) => {
        localStorage.setItem(
          `${prefix}_user`,
          JSON.stringify({
            id: 1,
            email: 'test@example.com',
            nickname: '테스트크루',
            picture: null,
            role: prefix === 'bo' ? 'ADMIN' : 'MEMBER',
            timeZone: 'Asia/Seoul',
            onboardingCompletedAt: '2026-01-01T00:00:00Z',
          }),
        );
      }, app);
    });

    test('access 만료 후 화면 진입과 새로고침에서 재로그인 없이 갱신한다', async ({ page, context }) => {
      await refreshCookie(context, app.prefix, `valid-${app.prefix}`);
      await page.goto(app.origin + app.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(app.origin + app.path);
      await expect(page.getByRole('heading', { name: app.heading, exact: true })).toBeVisible();
      const cookie = (await context.cookies()).find((c) => c.name === `${app.prefix}_stage_access_token`);
      expect(cookie).toMatchObject({ value: 'browser-test-access', httpOnly: true, path: '/' });
      expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(800);
      await context.clearCookies({ name: `${app.prefix}_stage_access_token` });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(app.origin + app.path);
      await expect(page.getByRole('heading', { name: app.heading, exact: true })).toBeVisible();
      expect((await context.cookies()).some((c) => c.name === `${app.prefix}_stage_access_token`)).toBe(true);
    });

    test('일시적인 갱신 장애 후 다시 시도하면 같은 화면으로 복귀한다', async ({ page, context }) => {
      await refreshCookie(context, app.prefix, `retry-${app.prefix}`);
      const response = await page.goto(app.origin + app.path, { waitUntil: 'domcontentloaded' });
      expect(response!.status()).toBe(503);
      await expect(page.getByRole('heading', { name: '로그인을 확인하지 못했습니다' })).toBeVisible();
      expect((await context.cookies()).find((c) => c.name === `${app.prefix}_stage_refresh_token`)?.value).toBe(
        `retry-${app.prefix}`,
      );
      await page.getByRole('link', { name: '다시 시도', exact: true }).click();
      await expect(page).toHaveURL(app.origin + app.path);
      await expect(page.getByRole('heading', { name: app.heading, exact: true })).toBeVisible();
    });

    test('refresh가 실제로 무효하면 로그인으로 보내고 쿠키를 지운다', async ({ page, context }) => {
      await refreshCookie(context, app.prefix, 'revoked');
      await page.goto(app.origin + app.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(`${app.origin}${app.login}?next=${encodeURIComponent(app.path)}`);
      expect((await context.cookies()).some((c) => c.name === `${app.prefix}_stage_refresh_token`)).toBe(false);
    });
  });
}
