// The benchmark's screenshot tests, which `run.ts` writes into
// .vitest/bench/screenshots/. Each draws a panel on a canvas in the page and
// checks it with Vitest's `toMatchScreenshot`. Vitest's browser mode keeps its
// defaults, as a project would: a fresh page for each test file, and several
// files at once. The browser is the one that v-snap uses, launched with the
// same settings, so both draw alike.
import { playwright } from '@vitest/browser-playwright';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

/** v-snap's package folder, which the paths are relative to. */
const PACKAGE_DIR = join(import.meta.dirname, '..');

export default defineConfig({
    root: PACKAGE_DIR,
    test: {
        name: 'bench-screenshots',
        include: ['.vitest/bench/screenshots/*.test.ts'],
        browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            viewport: { width: 1280, height: 800 },
            provider: playwright({
                launchOptions: {
                    args: [
                        '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu-rasterization',
                        '--disable-gpu',
                        '--disable-gpu-compositing',
                        '--disable-lcd-text',
                        '--font-render-hinting=none',
                        '--force-color-profile=srgb',
                        '--force-device-scale-factor=1',
                        '--hide-scrollbars',
                    ],
                },
                contextOptions: { locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1 },
            }),
            instances: [{ browser: 'chromium' }],
        },
    },
});
