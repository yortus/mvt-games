/**
 * Times a page loading uncached, in headless Chrome: when its DOM was ready,
 * when its last request finished, and when content first showed below the
 * site's nav bar.
 *
 * Usage:  npm run measure-load -- <url> [--runs=2] [--throttle] [--waterfall]
 *
 *   --runs=N      load the page N times in one browser (the first pays for
 *                 connecting; later ones show a warm connection)
 *   --throttle    150 ms of latency and about 1.1 MB/s, roughly a fast mobile network
 *   --waterfall   list every request, when it started and finished
 *
 * "Content" is the first screenshot, taken every ~150 ms, with more than 0.3%
 * of its pixels bright, so a dark page with nothing drawn yet does not count.
 * Each launch of headless Chrome can cost a failed Windows logon (see
 * `headless-chrome.ts`): measure a handful of runs, not loops of them.
 */

import { PNG } from 'pngjs';
import { launchHeadlessChrome } from './headless-chrome';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (url === undefined) throw new Error('Usage: npm run measure-load -- <url> [--runs=2] [--throttle] [--waterfall]');
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice('--runs='.length) ?? 2);
const throttle = args.includes('--throttle');
const waterfall = args.includes('--waterfall');

const VIEWPORT = { width: 1280, height: 800 };
const NAV_HEIGHT = 60;
const SAMPLE_FOR_MS = 12000;
const BRIGHT_LUMINANCE = 60;
const CONTENT_FRACTION = 0.003;

const browser = await launchHeadlessChrome();
try {
    await browser.send('Network.enable');
    await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
    await browser.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
    await browser.send('Network.emulateNetworkConditions', throttle
        ? { offline: false, latency: 150, downloadThroughput: 1.1e6, uploadThroughput: 94e3 }
        : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    for (let run = 1; run <= runs; run++) {
        await browser.navigate('about:blank');
        const startMs = Date.now();
        await browser.send('Page.navigate', { url });
        let contentMs: number | undefined;
        while (Date.now() - startMs < SAMPLE_FOR_MS && contentMs === undefined) {
            const elapsedMs = Date.now() - startMs;
            if (await brightFraction() > CONTENT_FRACTION) contentMs = elapsedMs;
        }
        const timing = await browser.evaluate<{ domReady: number; lastRequest: number; requests: [string, number, number][] }>(`(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const res = performance.getEntriesByType('resource');
            return {
                domReady: Math.round(nav ? nav.domContentLoadedEventEnd : 0),
                lastRequest: Math.round(res.reduce((m, r) => Math.max(m, r.responseEnd), 0)),
                requests: res.map((r) => [r.name.split('/').pop(), Math.round(r.startTime), Math.round(r.responseEnd)]),
            };
        })()`);
        const content = contentMs === undefined ? `none in ${SAMPLE_FOR_MS} ms` : `${contentMs} ms`;
        console.log(`Run ${run}: DOM ready ${timing.domReady} ms, last request ${timing.lastRequest} ms, content ${content}`);
        if (waterfall) {
            for (const [name, start, end] of timing.requests) {
                console.log(`    ${String(start).padStart(6)} ${String(end).padStart(6)}  ${name}`);
            }
        }
    }
}
finally {
    await browser.close();
}

/** The fraction of the page below the nav bar that is bright, from a quarter-size screenshot. */
async function brightFraction(): Promise<number> {
    let data: string | undefined;
    for (let tries = 0; data === undefined; tries++) {
        try {
            ({ data } = await browser.send<{ data: string }>('Page.captureScreenshot', {
                format: 'png',
                clip: { x: 0, y: NAV_HEIGHT, width: VIEWPORT.width, height: VIEWPORT.height - NAV_HEIGHT, scale: 0.25 },
            }));
        }
        catch (error) {
            // Mid-navigation, the page may have no frame to capture yet
            if (tries > 50) throw error;
            await new Promise((resolveWait) => setTimeout(resolveWait, 50));
        }
    }
    const png = PNG.sync.read(Buffer.from(data, 'base64'));
    let bright = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        const luminance = 0.3 * png.data[i] + 0.59 * png.data[i + 1] + 0.11 * png.data[i + 2];
        if (luminance > BRIGHT_LUMINANCE) bright++;
    }
    return bright / (png.width * png.height);
}
