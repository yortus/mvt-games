// Spike probe: Playwright's default launch (a fresh temporary profile), once.
import { chromium } from 'playwright';

const t0 = performance.now();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
console.log(await page.evaluate(() => navigator.userAgent), Math.round(performance.now() - t0), 'ms');
await browser.close();
