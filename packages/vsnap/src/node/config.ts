/**
 * vsnap's Vitest projects, which a project lists in its own Vitest config,
 * beside its unit tests. `vsnap(options)` returns two projects, which bring
 * vsnap's reporter with them.
 *
 * - `<name>-canvas` runs the files that declare `canvasTest`, which test
 *   views drawn on a canvas. Every file runs in one shared page.
 * - `<name>-html` runs the files that declare `htmlTest`. Each file runs in
 *   a page of its own, since each file brings its own stylesheet.
 *
 * The project registers the kinds of view that its tests pose, such as Pixi
 * containers, in a `vsnap.config.ts` in the root. That file runs in the
 * test page, before the tests.
 *
 * The name is `visual` by default, so `vitest -p "visual-*"` runs the
 * visual tests alone. Each project gets its files from the declarations in
 * them, read when the config loads. So in watch mode, vsnap restarts Vitest
 * when a visual test file is added or deleted.
 *
 * Both run in Playwright's headless shell, a small build of Chromium for
 * headless use. It is launched with one fixed value for every setting that
 * differs between machines. A global setup step installs it if it is
 * missing, before the browser starts.
 */

import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin, TestProjectInlineConfiguration } from 'vitest/config';
import type { Reporter } from 'vitest/node';
import type { VisualKind } from '../protocol.ts';
import { createRunState, createVisualCommands } from './commands.ts';
import { createLayout } from './layout.ts';
import { toDisplayPath } from './paths.ts';
import { registerRoot } from './references.ts';
import { createVisualReporter } from './reporter.ts';
import { escapeGlob, findVisualTestFiles } from './test-files.ts';

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

/**
 * Returns the Vitest projects for a project's visual tests, `<name>-canvas`
 * and `<name>-html`, which the config lists in `test.projects`. They bring
 * vsnap's reporter with them, which prints the visual tests' summary. After
 * a complete run, it also checks every reference image, and handles the
 * reference images that no test used.
 */
export function vsnap(options: VsnapOptions = {}): TestProjectInlineConfiguration[] {
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
    const viewConfig = findViewConfig(root);
    const testFiles = [...files.canvas, ...files.html].map((file) => resolve(root, file));
    const includes = [...files.canvas, ...files.html].map(escapeGlob);
    const reporter = createVisualReporter({ layout, state, projectNames, testFiles, includes });
    const plugin = createVsnapPlugin({ reporter, root, files: () => findVisualTestFiles(layout), initialFiles: files });
    return kinds.map((kind, i) => createVisualProject({ ...options, root, name: projectNames[i], kind, files: files[kind], commands, viewConfig, plugin }));
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
    /** The project's `vsnap.config.ts`, if it has one. */
    readonly viewConfig: string | undefined;
    /** The plugin that the projects of one `vsnap` call share. */
    readonly plugin: Plugin;
}): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    const files = options.files;
    const setupFiles = [SETUP_FILE];
    // The config file is in the root, as the scan's globs are relative to it.
    const viewConfig = options.viewConfig === undefined ? [] : [basename(options.viewConfig)];
    return {
        root: options.root,
        plugins: [options.plugin],
        // The page imports the project's vsnap.config.ts by this name. Vite
        // resolves the import as it resolves a test's, so both get one module.
        resolve: { alias: { 'virtual:vsnap-config': options.viewConfig ?? NO_CONFIG } },
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
            entries: [...files.map(escapeGlob), ...setupFiles.map((file) => escapeGlob(file.replaceAll('\\', '/'))), ...viewConfig],
            force: true,
        },
        test: {
            name: options.name,
            // Each file is a glob to Vitest, so its name is escaped.
            include: files.map(escapeGlob),
            // The project runs one file at a time, so it needs a group of its
            // own, after the projects that run several at once. Its tests never
            // run concurrently, whatever the config they inherit says, since
            // they share a page.
            sequence: { groupOrder: 1, concurrent: false },
            globalSetup: [INSTALL_BROWSER],
            // An HTML view's stylesheet stays in the page once it is imported,
            // so each HTML file gets a fresh page.
            isolate: isHtml,
            fileParallelism: false,
            setupFiles,
            testTimeout: 30_000,
            provide: {
                visualKind: options.kind,
                visualMaxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS,
                visualHasConfig: options.viewConfig !== undefined,
                visualConfigFile: toDisplayPath(options.viewConfig ?? join(options.root, VIEW_CONFIG_NAMES[0])),
            },
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

/**
 * Returns the plugin that the projects of one `vsnap` call share. Vitest
 * calls its `configureVitest` for each project, before it makes its
 * reporters, and again after each restart.
 *
 * - It adds vsnap's reporter to the run, once, so that a project needn't
 *   add it. A run that filters out vsnap's projects has no reporter of
 *   vsnap's.
 * - In watch mode, it restarts Vitest when a visual test file is added or
 *   deleted. The projects get their files when the config loads, so a rerun
 *   alone would miss the change. Vitest restarts the same way when its own
 *   config changes.
 */
function createVsnapPlugin(options: {
    readonly reporter: Reporter;
    readonly root: string;
    /** Returns the project's visual test files, read afresh. */
    readonly files: () => Readonly<Record<VisualKind, readonly string[]>>;
    readonly initialFiles: Readonly<Record<VisualKind, readonly string[]>>;
}): Plugin {
    const listFiles = (files: Readonly<Record<VisualKind, readonly string[]>>): string => `${files.canvas.join('\n')}\n|\n${files.html.join('\n')}`;
    const initial = listFiles(options.initialFiles);
    const watched = new WeakSet<object>();
    return {
        name: 'vsnap',
        configureVitest: ({ vitest }) => {
            const reporters = vitest.config.reporters as unknown[];
            if (!reporters.includes(options.reporter)) reporters.push(options.reporter);
            const server = vitest.vite;
            if (!vitest.config.watch || watched.has(server)) return;
            watched.add(server);
            server.watcher.on('all', (event, file) => {
                // Only a script can be a test file, so the actual images that a run
                // writes don't make it read the files again.
                if (event !== 'add' && event !== 'unlink') return;
                if (!SCRIPT_FILE.test(file) || listFiles(options.files()) === initial) return;
                // Vitest makes this restart the whole run, as it does for its
                // own config.
                void server.restart();
            });
        },
    };
}

/** Returns the path of a project's `vsnap.config`, in its root, if it has one. */
function findViewConfig(root: string): string | undefined {
    for (const name of VIEW_CONFIG_NAMES) {
        const path = join(root, name);
        if (existsSync(path)) return path;
    }
    return undefined;
}

/** The settings of a project that has no `vsnap.config`, which register no kinds of view. */
const NO_CONFIG = resolve(import.meta.dirname, '..', 'browser', 'no-config.ts');

/** Matches the files that can be visual test files. */
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

/** The names that a project's `vsnap.config` may have. */
const VIEW_CONFIG_NAMES = ['vsnap.config.ts', 'vsnap.config.mts', 'vsnap.config.js', 'vsnap.config.mjs'];

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
