import type { Page } from 'playwright';
import type { AppFixture } from './electron-app';

/**
 * Wait for the app to be fully initialized (connected to backend, ready for interaction).
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 30_000 });
}

/**
 * Take a screenshot on test failure. Use in afterEach hooks.
 */
export async function screenshotOnFailure(
  fixture: AppFixture | undefined,
  testInfo: {
    status?: string;
    expectedStatus?: string;
    title: string;
    attachments: Array<{ name: string; path: string; contentType: string }>;
  }
): Promise<void> {
  if (testInfo.status !== testInfo.expectedStatus && fixture?.page) {
    const screenshotPath = `e2e/test-results/failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`;
    await fixture.page.screenshot({ path: screenshotPath });
    testInfo.attachments.push({
      name: 'screenshot',
      path: screenshotPath,
      contentType: 'image/png',
    });
  }
}
