/**
 * The visual tests' Vitest config, which a project makes with
 * `createVisualConfig`. It holds two Vitest projects and the reporters.
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
 * headless use. It is launched with one fixed value for every setting that
 * differs between machines.
 */

import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import type { InlineConfig } from 'vitest/node';
import type { VisualKind } from '../protocol';
import { createRunState, createVisualCommands } from './commands';
import { createLayout, type VisualLayout } from './layout';
import { createVisualReporters } from './reporter';
import { findVisualTestFiles } from './test-files';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The key under which a visual config holds its layout. */
export const LAYOUT_KEY: unique symbol = Symbol.for('@mvtjs/visual-testing/layout');

/** The `test` part of a Vitest config, which `createVisualConfig` returns. */
export interface VisualConfig {
    readonly projects: TestProjectInlineConfiguration[];
    readonly reporters: NonNullable<InlineConfig['reporters']>;
    /** The layout, which `visual-tests check-references` reads from the config. */
    readonly [LAYOUT_KEY]: VisualLayout;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VisualConfigOptions {
    /**
     * Globs for the visual test files, relative to the project's root, which
     * is the folder that holds `vitest.visual.config.ts`. The default is
     * `DEFAULT_INCLUDE`, the `*.visual.ts` and `*.visual.tsx` files under
     * `src/`.
     */
    readonly include?: readonly string[];
    /**
     * Where each reference image is kept, as a path template relative to the
     * project's root. The variables are `{testFileDir}`, `{testFileName}`,
     * `{testFilePath}` and `{imageName}`. `{imageName}` must appear once, in
     * the file name, which ends in `.png`. The default is
     * `DEFAULT_REFERENCE_PATH`, a `__references__` folder beside each test
     * file.
     */
    readonly referencePath?: string;
    /**
     * The size budget, which is the most pixels an image may have. A smooth
     * Pixi view over the budget is drawn at a lower resolution to fit (half,
     * a quarter, and so on). Pixel art and HTML are always drawn at full
     * size, so they fail when over the budget. Images cost storage in
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
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the `test` part of a project's visual Vitest config. It runs from
 * the project's root, the folder that holds the config, as the
 * `visual-tests` command does.
 */
export function createVisualConfig(options: VisualConfigOptions = {}): VisualConfig {
    const layout = createLayout({ root: process.cwd(), include: options.include, referencePath: options.referencePath });
    const files = findVisualTestFiles(layout);
    const state = createRunState();
    const commands = createVisualCommands({ layout, state });
    const kinds: readonly VisualKind[] = ['canvas', 'html'];
    return {
        projects: kinds.map((kind) => createVisualProject({ ...options, kind, files: files[kind], commands })),
        reporters: createVisualReporters({ layout, state }),
        [LAYOUT_KEY]: layout,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of visual test. */
function createVisualProject(options: VisualConfigOptions & {
    readonly kind: VisualKind;
    readonly files: readonly string[];
    readonly commands: ReturnType<typeof createVisualCommands>;
}): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    const files = options.files;
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
                commands: options.commands,
            },
        },
    };
}

/** The file that sets each page up before its tests, from this package. */
const SETUP_FILE = resolve(import.meta.dirname, '..', 'browser', 'setup.ts');

/**
 * The browser's switches. They fix everything that would otherwise differ
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
