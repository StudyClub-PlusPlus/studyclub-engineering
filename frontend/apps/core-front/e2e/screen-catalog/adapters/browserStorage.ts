import type { Page } from '@playwright/test';

import type { StorageSeed } from '../../../screen-catalog/types';

/**
 * localStorage에 seed 데이터를 주입한다.
 * page.goto() 이전에 호출하면 안 되므로 반드시 빈 페이지 navigate 이후에 실행한다.
 */
export async function seedBrowserStorage(page: Page, seeds: StorageSeed[]): Promise<void> {
  if (seeds.length === 0) return;

  // about:blank 로 이동해 localStorage에 접근 가능한 origin 확립
  const baseURL = page.context().browser()?.contexts()[0]?.pages()[0]?.url() ?? 'http://localhost:4700';
  const origin = new URL(baseURL).origin;

  // sc_access_token 쿠키 주입 (Next.js 미들웨어 /my, /onboarding 게이트 통과용)
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'dev-preview',
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.goto(`${origin}/ko`, { waitUntil: 'domcontentloaded' });

  await page.evaluate((items: StorageSeed[]) => {
    for (const { key, value } of items) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, seeds);
}
