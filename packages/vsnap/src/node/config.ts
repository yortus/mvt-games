/**
 * vsnap's Vitest projects, which a project lists in its own Vitest config,
 * beside its unit tests. `vsnap(options)` returns two projects and a
 * reporter.
 *
 * - `<name>-canvas` runs the files that declare `canvasTest`, which test
 *   Pixi and three.js views. Every file runs in one shared page.
 * - `<name>-html` runs the files that declare `htmlTest`. Each file runs in
 *   a page of its own, since each file brings its own stylesheet.
 *
 * The name is `visual` by default, so `vitest -p "visual-*"` runs the
 * visual tests alone. Each project gets its files from the declarations in
 * them, read when the config loads. So in watch mode, a new test file joins
 * the run only when Vitest restarts.
 *
 * Both run in Playwright's headless shell, a small build of Chromium for
 * headless use. It is launched with one fixed value for every setting that
 * differs between machines. A global setup step installs it if it is
 * missing, before the browser starts.
 */

import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import type { Reporter } from 'vitest/node';
import type { VisualKind } from '../protocol.ts';
import { createRunState, createVisualCommands } from './commands.ts';
import { createLayout } from './layout.ts';
import { registerRoot } from './references.ts';
import { createVisualReporter } from './reporter.ts';
import { findVisualTestFiles } from './test-files.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What `vsnap` returns, for a project's Vitest config. */
export interface Vsnap {
    /** The Vitest projects, `<name>-canvas` and `<name>-html`. List them in the config's `test.projects`. */
    readonly projects: TestProjectInlineConfiguration[];
    /**
     * The reporter that prints the visual tests' summary. After a complete
     * run, it also checks every reference image, and handles the reference
     * images that no test used. Add it to the config's `test.reporters`.
     */
    readonly reporter: Reporter;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VsnapOptions {
    /**
     * The start of the projects' names, which end in `-canvas` and `-html`.
     * The default is `visual`.
     */
    readonly name?: string;
    /** The folder that the other paths are relative to. The default is the folder Vitest runs in. */
    readonly root?: string;
    /**
     * Globs for the visual test files, relative to the root. The default is
     * `DEFAULT_INCLUDE`, the `*.visual.test.ts` and `*.visual.test.tsx`
     * files.
     */
    readonly include?: readonly string[];
    /**
     * Where each reference image is kept, as a path template relative to the
     * root. The variables are `{testFileDir}`, `{testFileName}`,
     * `{testFilePath}` and `{imageName}`. `{imageName}` must appear once, in
     * the file name, which ends in `.png`. The default is
     * `DEFAULT_REFERENCE_PATH`, a `__references__` folder beside each test
     * file.
     */
    readonly referencePath?: string;
    /**
     * The size budget, which is the most pixels an image may have. A smooth
     * view over the budget is drawn at a lower resolution to fit (half, a
     * quarter, and so on). Pixel art and HTML are always drawn at full size,
     * so they fail when over the budget. Images cost storage in every
     * version of every reference, and they cost drawing time. The default is
     * `DEFAULT_MAX_PIXELS`.
     */
    readonly maxPixels?: number;
    /**
     * A Vite config for the projects to extend, relative to the root. By
     * default, they inherit the config they are listed in, plugins included,
     * as Vitest's `extends: true` does. A monorepo whose views need a
     * package's own Vite config names it here.
     */
    readonly viteConfig?: string;
    /**
     * A module, relative to the root, that runs in the test page before the
     * tests. It can call `setViewHooks`, to prepare each view before its
     * image is taken and to dispose of it after.
     */
    readonly setup?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The default size budget, which is about a 960 by 540 screen. */
export const DEFAULT_MAX_PIXELS = 500_000;

/** The default start of the projects' names. */
export const DEFAULT_NAME = 'visual';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns the Vitest projects and the reporter for a project's visual tests. */
export function vsnap(options: VsnapOptions = {}): Vsnap {
    const root = resolve(options.root ?? process.cwd());
    const name = options.name ?? DEFAULT_NAME;
    const layout = createLayout({ root, include: options.include, referencePath: options.referencePath });
    registerRoot(root);
    const files = findVisualTestFiles(layout);
    const state = createRunState();
    const commands = createVisualCommands({ layout, state });
    // A kind of test with no files gets no project.
    const kinds = (['canvas', 'html'] as const).filter((kind) => files[kind].length > 0);
    const projectNames = kinds.map((kind) => `${name}-${kind}`);
    const projects = kinds.map((kind, i) => createVisualProject({ ...options, root, name: projectNames[i], kind, files: files[kind], commands }));
    const testFiles = [...files.canvas, ...files.html].map((file) => resolve(root, file));
    const includes = [...files.canvas, ...files.html];
    const reporter = createVisualReporter({ layout, state, projectNames, testFiles, includes });
    return { projects, reporter };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of visual test. */
function createVisualProject(options: VsnapOptions & {
    readonly root: string;
    readonly name: string;
    readonly kind: VisualKind;
    readonly files: readonly string[];
    readonly commands: ReturnType<typeof createVisualCommands>;
}): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    const files = options.files;
    const setupFiles = [SETUP_FILE, ...(options.setup === undefined ? [] : [resolve(options.root, options.setup)])];
    return {
        root: options.root,
        // The project inherits the config it is listed in, plugins included, as
        // Vitest's `extends: true` does, unless a Vite config is named.
        extends: options.viteConfig === undefined ? true : resolve(options.root, options.viteConfig),
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
            name: options.name,
            include: [...files],
            // The project runs one file at a time, so it needs a group of its
            // own, after the projects that run several at once.
            sequence: { groupOrder: 1 },
            globalSetup: [INSTALL_BROWSER],
            // An HTML view's stylesheet stays in the page once it is imported,
            // so each HTML file gets a fresh page.
            isolate: isHtml,
            fileParallelism: false,
            setupFiles,
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
                // Named, so that the project's name has no "(chromium)" after it.
                instances: [{ browser: 'chromium', name: options.name }],
                commands: options.commands,
            },
        },
    };
}

/** The file that sets each page up before its tests, from this package. */
const SETUP_FILE = resolve(import.meta.dirname, '..', 'browser', 'setup.ts');

/** The global setup step that installs the browser if it is missing. */
const INSTALL_BROWSER = resolve(import.meta.dirname, 'install-browser.ts');

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
