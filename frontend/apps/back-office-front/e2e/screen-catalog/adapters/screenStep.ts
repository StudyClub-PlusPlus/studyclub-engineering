import type { Page } from '@playwright/test';

import type { ScreenStep } from '../../../screen-catalog/types';

export async function executeSteps(page: Page, steps: ScreenStep[]): Promise<void> {
  for (const step of steps) {
    switch (step.action) {
      case 'click':
        if (!step.selector) throw new Error('click step requires selector');
        await page.locator(step.selector).click();
        break;
      case 'fill':
        if (!step.selector) throw new Error('fill step requires selector');
        await page.locator(step.selector).fill(step.value ?? '');
        break;
      case 'wait':
        await page.waitForTimeout(step.ms ?? 500);
        break;
    }
  }
}
