/**
 * The visual tests run as two Vitest projects, which this file creates.
 *
 * - `visual-canvas` runs the files that declare `canvasTest`, which
 *   test Pixi and three.js views. Every file runs in one shared page.
 * - `visual-html` runs the files that declare `htmlTest`. Each file
 *   runs in a page of its own, since each file brings its own stylesheet.
 *
 * Each project gets its files from the declarations in them, read when the
 * config loads. So in watch mode, a new test file joins the run only when
 * Vitest restarts.
 *
 * Both run in Playwright's headless shell, a small build of Chromium for
 * headless use. It is launched with every setting that differs between
 * machines pinned to one value.
 */

import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import type { VisualKind } from '../protocol';
import { visualCommands } from './commands';
import { findVisualTestFiles } from './test-files';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VisualProjectOptions {
    readonly kind: VisualKind;
    /**
     * The size budget, which is the most pixels a picture may have. A smooth
     * Pixi view over the budget is drawn at a lower resolution to fit (half,
     * a quarter, and so on). Pixel art and HTML are always drawn at full
     * size, so they fail when over the budget. Pictures cost storage in
     * every version of every reference, and they cost drawing time. The
     * default is `DEFAULT_MAX_PIXELS`.
     */
    readonly maxPixels?: number;
    /**
     * The Vite config that the project extends, relative to the Vitest config
     * file. It gives the tested code the plugins and aliases that it needs.
     */
    readonly viteConfig?: string;
}

/** The default size budget, which is about a 960 by 540 screen. */
export const DEFAULT_MAX_PIXELS = 500_000;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of visual test, run from the folder that holds the Vitest config. */
export function createVisualProject(options: VisualProjectOptions): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    const files = findVisualTestFiles(process.cwd())[options.kind];
    return {
        ...(options.viteConfig === undefined ? {} : { extends: options.viteConfig }),
        // Every file of a kind runs in one page, so Vite must bundle every
        // library that the tests import before the run starts. If it found one
        // during the run, it would bundle again, and the files after that
        // point would load a second copy of a library such as Pixi, whose
        // objects are not the first copy's. So Vite scans the test files and
        // the harness's setup for the libraries they import, and bundles them
        // afresh on every run. A cache from an earlier run would skip the
        // scan, and miss a library that a test has started to import. The
        // bundling takes about a second.
        optimizeDeps: {
            entries: [...files, SETUP_FILE],
            force: true,
        },
        test: {
            name: `visual-${options.kind}`,
            include: [...files],
            // An HTML view's stylesheet stays in the page once it is imported,
            // so each HTML file gets a fresh page.
            isolate: isHtml,
            fileParallelism: false,
            setupFiles: [SETUP_FILE],
            testTimeout: 30_000,
            provide: { visualKind: options.kind, visualMaxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS },
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
                commands: visualCommands,
            },
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The file that sets each page up before its tests, from this package. */
const SETUP_FILE = resolve(import.meta.dirname, '..', 'browser', 'setup.ts');

/**
 * The browser's switches. They pin everything that would otherwise differ
 * between machines.
 */
const BROWSER_ARGS = [
    // WebGL runs on the CPU, in SwiftShader, so every system runs the same
    // code.
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    // 2D drawing and compositing run on the CPU too. Otherwise, macOS
    // composites transformed boxes its own way.
    '--disable-accelerated-2d-canvas',
    '--disable-gpu-rasterization',
    '--disable-gpu',
    '--disable-gpu-compositing',
    // Text uses grayscale antialiasing, and hinting is off. Hinting snaps
    // glyphs to the pixel grid. With it off, Linux keeps the fraction of
    // each character's advance (its width), as Windows and macOS do.
    '--disable-lcd-text',
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
];
