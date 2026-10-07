// Spike: the visual project. Run from the repo root:
//   npx vitest run --config packages/website/visual-spike/vitest.config.ts
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import site from '../vite.config';
import { spikeCommands } from './commands';

const workers = Number(process.env.SPIKE_WORKERS ?? 1);
const isolate = process.env.SPIKE_ISOLATE === '1';
const include = (process.env.SPIKE_INCLUDE ?? 'visual-spike/**/*.visual.tsx').split(',');

/** Pinned inside the browser: software WebGL (SwiftShader), software 2D canvas, grayscale text, sRGB, scale 1. */
const BROWSER_ARGS = [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu-rasterization',
    '--disable-lcd-text',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    ...(process.env.SPIKE_EXTRA_ARGS ?? '').split(' ').filter(Boolean),
];

export default mergeConfig(site, defineConfig({
    // Every file shares one page, so a dependency found mid-run must not be
    // re-bundled: the page would then hold two copies of Pixi, whose objects
    // (Texture.WHITE) are not each other's. Bundle them all before the first test.
    optimizeDeps: {
        include: ['pixi.js', 'three', 'three/addons/environments/RoomEnvironment.js', 'gsap'],
    },
    test: {
        include,
        isolate,
        fileParallelism: workers > 1,
        maxWorkers: workers,
        setupFiles: ['visual-spike/setup.ts'],
        testTimeout: 30_000,
        browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            dependencySourcemaps: false,
            viewport: { width: 1280, height: 800 },
            provider: playwright({
                launchOptions: { args: BROWSER_ARGS },
                contextOptions: { locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' },
            }),
            instances: [{ browser: 'chromium' }],
            commands: spikeCommands,
        },
    },
}));
