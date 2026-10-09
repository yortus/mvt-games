/**
 * The visual tests run as two Vitest projects, which this file creates.
 *
 * - `visual` tests Pixi and three.js views. Every file runs in one shared
 *   page.
 * - `visual-html` tests HTML views. Each file runs in a page of its own,
 *   since each file brings its own stylesheet.
 *
 * Both run in Playwright's headless shell, a small build of Chromium for
 * headless use. It is launched with every setting that differs between
 * machines pinned to one value.
 */

import { playwright } from '@vitest/browser-playwright';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import type { VisualKind } from '../../src/testing';
import { visualCommands } from './commands';

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
}

/** The default size budget, which is about a 960 by 540 screen. */
export const DEFAULT_MAX_PIXELS = 500_000;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export function createVisualProject(options: VisualProjectOptions): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    return {
        extends: './vite.config.ts',
        // One page runs many files, so a dependency found during the run must
        // not be bundled again. If it were, the files after it would load a
        // second copy of Pixi, whose objects (such as Texture.WHITE) are not
        // the first copy's. So this lists every dependency that an entry or
        // the test harness imports, and a new one belongs here.
        optimizeDeps: {
            include: [
                'pixi.js', 'pixi-solid', 'solid-js', 'solid-js/store', 'three', 'three/addons/environments/RoomEnvironment.js',
                'gsap', 'fontkit',
            ],
        },
        test: {
            name: isHtml ? 'visual-html' : 'visual',
            include: isHtml ? ['src/**/*.html.visual.tsx'] : ['src/**/*.visual.tsx'],
            exclude: isHtml ? [] : ['src/**/*.html.visual.tsx'],
            // An HTML view's stylesheet stays in the page once it is imported,
            // so each HTML file gets a fresh page.
            isolate: isHtml,
            fileParallelism: false,
            setupFiles: ['src/testing/setup.ts'],
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
