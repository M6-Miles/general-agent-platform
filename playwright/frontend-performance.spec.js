import {test, expect} from '@playwright/test';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';

test('记录首页浏览器首屏性能指标', async ({page}) => {
  await page.goto(`${webUrl}/login?performance=${Date.now()}`, {waitUntil: 'load'});
  await page.waitForFunction(
    () => performance.getEntriesByName('first-contentful-paint').length > 0,
  );
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    return {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
      load: Math.round(navigation.loadEventEnd),
      fcp: Math.round(paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0),
    };
  });
  console.log(`browser-performance ${JSON.stringify(metrics)}`);
  expect(metrics.domContentLoaded).toBeGreaterThan(0);
  expect(metrics.fcp).toBeGreaterThan(0);
});
