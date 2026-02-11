import { test, expect } from 'playwright/test';
import { launchApp, closeApp, type AppFixture } from '../fixtures/electron-app';
import { screenshotOnFailure } from '../fixtures/helpers';

test.describe('Smoke Test', () => {
  let fixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await launchApp();
  });

  test.afterAll(async () => {
    await closeApp(fixture);
  });

  // eslint-disable-next-line no-empty-pattern
  test.afterEach(async ({}, testInfo) => {
    await screenshotOnFailure(fixture, testInfo);
  });

  test('should launch the app and show the main window', async () => {
    expect(fixture.page).not.toBeNull();

    const title = await fixture.page.title();
    expect(title).toContain('GitChorus');

    const appReady = fixture.page.locator('[data-testid="app-ready"]');
    await expect(appReady).toBeVisible({ timeout: 15_000 });
  });
});
