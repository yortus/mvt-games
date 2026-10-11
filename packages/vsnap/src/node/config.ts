/**
 * The visual tests' Vitest config, which `createVisualConfig` makes from a
 * project's `vsnap.config.ts`. It holds two Vitest projects and the
 * reporters.
 *
 * - `vsnap-canvas` runs the files that declare `canvasTest`, which
 *   test Pixi and three.js views. Every file runs in one shared page.
 * - `vsnap-html` runs the files that declare `htmlTest`. Each file
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
import type { VsnapConfig } from './config-file';
import { createLayout } from './layout';
import { REPO_ROOT, toDisplayPath } from './paths';
import { createVisualReporters } from './reporter';
import { findVisualTestFiles } from './test-files';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The `test` part of a Vitest config, which `createVisualConfig` returns. */
export interface VisualConfig {
    readonly projects: TestProjectInlineConfiguration[];
    readonly reporters: NonNullable<InlineConfig['reporters']>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The default size budget, which is about a 960 by 540 screen. */
export const DEFAULT_MAX_PIXELS = 500_000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the `test` part of the Vitest config for a project, from its `vsnap.config.ts` and its root. */
export function createVisualConfig(options: VsnapConfig & { readonly root: string }): VisualConfig {
    const layout = createLayout({ root: options.root, include: options.include, referencePath: options.referencePath });
    const files = findVisualTestFiles(layout);
    const state = createRunState();
    const commands = createVisualCommands({ layout, state });
    const kinds: readonly VisualKind[] = ['canvas', 'html'];
    return {
        projects: kinds.map((kind) => createVisualProject({ ...options, kind, files: files[kind], commands })),
        reporters: createVisualReporters({ layout, state }),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of visual test. */
function createVisualProject(options: VsnapConfig & {
    readonly root: string;
    readonly kind: VisualKind;
    readonly files: readonly string[];
    readonly commands: ReturnType<typeof createVisualCommands>;
}): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    const files = options.files;
    const setupFiles = [SETUP_FILE, ...(options.setup === undefined ? [] : [resolve(options.root, options.setup)])];
    // The project's folder as messages show it, for the commands they suggest.
    const projectDir = options.root === REPO_ROOT ? '' : toDisplayPath(options.root);
    return {
        root: options.root,
        ...(options.viteConfig === undefined ? {} : { extends: resolve(options.root, options.viteConfig) }),
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
            entries: [...files, ...setupFiles],
            force: true,
        },
        test: {
            name: `vsnap-${options.kind}`,
            include: [...files],
            // An HTML view's stylesheet stays in the page once it is imported,
            // so each HTML file gets a fresh page.
            isolate: isHtml,
            fileParallelism: false,
            setupFiles,
            testTimeout: 30_000,
            provide: { visualKind: options.kind, visualMaxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS, visualProjectDir: projectDir },
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
