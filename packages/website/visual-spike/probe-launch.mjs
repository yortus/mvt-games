// Spike probe: launch Playwright's headless shell once, with a persistent
// profile, and report what WebGL and 2D canvas it gives.
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const profile = resolve(import.meta.dirname, '../../../node_modules/.cache/visual-spike-profile');
const args = (process.env.SPIKE_ARGS ?? '--use-angle=swiftshader --enable-unsafe-swiftshader --disable-accelerated-2d-canvas').split(' ').filter(Boolean);

const t0 = performance.now();
const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args,
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
});
const t1 = performance.now();
const page = context.pages()[0] ?? await context.newPage();
const info = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const c2 = document.createElement('canvas').getContext('2d', { willReadFrequently: false });
    return {
        ua: navigator.userAgent,
        webgl2: gl !== null,
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : undefined,
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : undefined,
        maxSamples: gl?.getParameter(gl.MAX_SAMPLES),
        ctx2d: c2 !== null,
        locale: Intl.DateTimeFormat().resolvedOptions(),
        dpr: devicePixelRatio,
    };
});
console.log(JSON.stringify({ launchMs: Math.round(t1 - t0), args, ...info }, null, 2));
await context.close();
