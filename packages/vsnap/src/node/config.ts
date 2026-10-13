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

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin, TestProjectInlineConfiguration } from 'vitest/config';
import type { Reporter } from 'vitest/node';
import type { VisualKind } from '../protocol.ts';
import { createRunState, createVisualCommands } from './commands.ts';
import { createLayout } from './layout.ts';
import { toDisplayPath } from './paths.ts';
import { forgetFingerprint, mustRebundle, recordFingerprint } from './rebundle.ts';
import { registerRoot, toFileKey } from './references.ts';
import { createVisualReporter } from './reporter.ts';
import { describeProblems, escapeGlob, findVisualTestFiles, type VisualTestFiles } from './test-files.ts';

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
     * The project's `vsnap.config.ts`, relative to the root, which registers
     * the kinds of view that its tests pose and runs in the test page. By
     * default, it is `vsnap.config.ts` (or `.mts`, `.js` or `.mjs`) in the
     * root, if there is one. Naming it shows a reader of the Vitest config
     * where the rest of vsnap's settings are.
     */
    readonly config?: string;
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
    warnOfProblems(files.problems);
    claimTestFiles(name, [...files.canvas, ...files.html].map((file) => resolve(root, file)));
    const state = createRunState();
    const commands = createVisualCommands({ layout, state });
    // A kind of test with no files gets no project.
    const kinds = (['canvas', 'html'] as const).filter((kind) => files[kind].length > 0);
    const projectNames = kinds.map((kind) => `${name}-${kind}`);
    const viewConfig = findViewConfig(root, options.config);
    if (viewConfig !== undefined) checkViewConfig(viewConfig);
    const allFiles = [...files.canvas, ...files.html];
    const reporter = createVisualReporter({
        layout,
        state,
        projectNames,
        testFiles: allFiles.map((file) => resolve(root, file)),
        includes: allFiles.map(escapeGlob),
        setupFiles: [SETUP_FILE],
        problems: files.problems,
    });
    const plugin = createVsnapPlugin({ reporter, name, root, files: () => findVisualTestFiles(layout), initialFiles: files });
    const rebundle = mustRebundle(name);
    return kinds.map((kind, i) => createVisualProject({
        rebundle,
        root,
        name: projectNames[i],
        kind,
        files: files[kind],
        commands,
        viewConfig,
        plugin,
        maxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS,
        viteConfig: options.viteConfig,
    }));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of visual test. */
function createVisualProject(options: {
    /** Whether Vite must bundle the libraries afresh, since the sources changed. */
    readonly rebundle: boolean;
    readonly root: string;
    readonly maxPixels: number;
    readonly viteConfig: string | undefined;
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
    // The scan's globs are relative to the root.
    const viewConfig = options.viewConfig === undefined ? [] : [escapeGlob(relative(options.root, options.viewConfig).replaceAll('\\', '/'))];
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
        // library that the tests import before the run starts. Vite scans the
        // test files and the harness's setup for them. It bundles afresh when
        // the sources changed since the last run, and reuses its cache when
        // they didn't, which saves most of a second (see rebundle.ts).
        //
        // vsnap itself is never bundled. The setup file loads vsnap's page
        // code by path, so a bundled copy for the tests would be a second
        // copy, and it would hold a copy of the project's vsnap.config.ts.
        // So Vite can't scan vsnap's code for the libraries it imports, and
        // they are named instead.
        optimizeDeps: {
            entries: [...files.map(escapeGlob), ...setupFiles.map((file) => escapeGlob(file.replaceAll('\\', '/'))), ...viewConfig],
            exclude: [...PACKAGE_ENTRIES],
            include: ['vsnap > fontkit', ...RENDERERS.filter((name) => isInstalled(name, options.root))],
            force: options.rebundle,
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
                visualMaxPixels: options.maxPixels,
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
 * - It records the sources' fingerprint, since the projects bundle their
 *   libraries in this run. In watch mode, a changed script makes the next
 *   decision read the sources again.
 * - In watch mode, it restarts Vitest when the visual test files change:
 *   when one is added or deleted, or when a file that matches the globs
 *   starts or stops declaring tests, as a new empty file does once its first
 *   test is written. The projects get their files when the config loads, so
 *   a rerun alone would miss the change. Vitest restarts the same way when
 *   its own config changes.
 */
function createVsnapPlugin(options: {
    readonly reporter: Reporter;
    /** The `vsnap` call's name, for its sources' fingerprint. */
    readonly name: string;
    readonly root: string;
    /** Returns the project's visual test files, read afresh. */
    readonly files: () => VisualTestFiles;
    readonly initialFiles: VisualTestFiles;
}): Plugin {
    const listFiles = (files: VisualTestFiles): string => `${files.canvas.join('\n')}\n|\n${files.html.join('\n')}`;
    const initial = listFiles(options.initialFiles);
    /** The files that match the globs, test files or not, by their paths relative to the root. */
    let known = listKnownFiles(options.initialFiles);
    const watched = new WeakSet<object>();
    return {
        name: 'vsnap',
        configureVitest: ({ vitest }) => {
            const reporters = vitest.config.reporters as unknown[];
            if (!reporters.includes(options.reporter)) reporters.push(options.reporter);
            // The projects run, and so bundle, in this run.
            recordFingerprint(options.name);
            const server = vitest.vite;
            if (!vitest.config.watch || watched.has(server)) return;
            watched.add(server);
            server.watcher.on('all', (event, file) => {
                // Only a script can be a test file, or import a library, so the
                // actual images that a run writes are ignored.
                if (!SCRIPT_FILE.test(file)) return;
                forgetFingerprint();
                // A change matters only to a file that matches the globs, whose
                // declarations decide its project.
                if (event === 'change' && !known.has(relative(options.root, file).replaceAll('\\', '/'))) return;
                if (event !== 'add' && event !== 'unlink' && event !== 'change') return;
                // An error here would end Vitest, so it is reported instead.
                let files: VisualTestFiles;
                try {
                    files = options.files();
                }
                catch (error) {
                    console.warn(`vsnap: couldn't read the visual test files after ${file} changed, so it kept the files it had: ${error instanceof Error ? error.message : String(error)}`);
                    return;
                }
                known = listKnownFiles(files);
                warnOfProblems(files.problems);
                if (listFiles(files) === initial) return;
                // Vitest makes this restart the whole run, as it does for its
                // own config.
                void server.restart();
            });
        },
    };
}

/**
 * Records a `vsnap` call's test files, and throws if another call, with
 * another name, already has one of them. Each would run the file in its
 * own projects, and the two would write the same reference images.
 */
function claimTestFiles(name: string, files: readonly string[]): void {
    const owners = ((globalThis as { vsnapTestFiles?: Map<string, string> }).vsnapTestFiles ??= new Map());
    for (const file of files) {
        const owner = owners.get(toFileKey(file));
        if (owner !== undefined && owner !== name) {
            throw new Error(`vsnap: ${toDisplayPath(file)} is a visual test file of two vsnap calls, '${owner}' and '${name}', whose include globs both match it. Give the calls includes that don't overlap.`);
        }
    }
    for (const file of files) owners.set(toFileKey(file), name);
}

/** Returns the paths of the files that match the globs, test files or not. */
function listKnownFiles(files: VisualTestFiles): Set<string> {
    return new Set([...files.canvas, ...files.html, ...files.problems.map((p) => p.file)]);
}

/**
 * Warns once about each visual test file that can't run. The run fails over
 * them only when vsnap's projects run, through the reporter, so a run of
 * the project's other tests, or a tool that lists the tests, isn't stopped
 * by a file that is half written.
 */
function warnOfProblems(problems: VisualTestFiles['problems']): void {
    const fresh = problems.filter((p) => !WARNED.has(`${p.file}: ${p.problem}`));
    if (fresh.length === 0) return;
    for (const p of fresh) WARNED.add(`${p.file}: ${p.problem}`);
    console.warn(`vsnap: ${describeProblems(fresh)}`);
}

/**
 * Returns the path of a project's `vsnap.config`: the one that the `config`
 * option names, or the one in its root, if it has one. It throws if the
 * option names a file that doesn't exist.
 */
function findViewConfig(root: string, named: string | undefined): string | undefined {
    if (named !== undefined) {
        const path = resolve(root, named);
        if (!existsSync(path)) throw new Error(`vsnap's config option names ${toDisplayPath(path)}, which doesn't exist.`);
        return path;
    }
    for (const name of VIEW_CONFIG_NAMES) {
        const path = join(root, name);
        if (existsSync(path)) return path;
    }
    return undefined;
}

/**
 * Checks a project's `vsnap.config` by its text, without running it, since
 * it runs in the test page. It throws if the file has no default export,
 * which vsnap reads. It warns if the file mentions neither `Register` nor
 * `bindCanvasTest`, since then `canvasTest`'s types don't know its kinds of
 * view, and every test of a registered kind is a type error.
 */
function checkViewConfig(file: string): void {
    const text = readFileSync(file, 'utf8');
    if (!/\bexport\s+default\b/.test(text)) {
        throw new Error(`${toDisplayPath(file)} has no default export. It exports its config as default: export default defineVsnapConfig({ ... }).`);
    }
    if (!/\b(?:Register|bindCanvasTest)\b/.test(text) && !WARNED.has(file)) {
        WARNED.add(file);
        console.warn(
            `vsnap: ${toDisplayPath(file)} doesn't give its config's type to vsnap, so canvasTest's types don't know its kinds of view. Add:\n`
            + "    declare module 'vsnap' {\n        interface Register {\n            config: typeof config;\n        }\n    }\n"
            + 'In a monorepo whose packages have configs of their own, export bindCanvasTest(config) instead, and import canvasTest from the config.',
        );
    }
}

/**
 * Returns whether a package is installed where a project's root can import
 * it, in a `node_modules` folder in the root or above it.
 */
function isInstalled(name: string, root: string): boolean {
    for (let dir = root; ; dir = dirname(dir)) {
        if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return true;
        if (dirname(dir) === dir) return false;
    }
}

/** The names of this package's entry points that run in the test page. */
const PACKAGE_ENTRIES = ['vsnap', 'vsnap/pixi', 'vsnap/three'];

/** The libraries that vsnap's support for Pixi and three.js imports, which a project installs if it uses them. */
const RENDERERS = ['pixi.js', 'three'];

/** The extension of this package's modules: `.ts` in its source, and `.js` once built. */
const EXTENSION = extname(import.meta.filename);

/** The settings of a project that has no `vsnap.config`, which register no kinds of view. */
const NO_CONFIG = resolve(import.meta.dirname, '..', 'browser', `no-config${EXTENSION}`);

/** Matches the files that can be visual test files. */
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

/**
 * What this process has warned about: config files, and visual test files
 * that can't run. Vitest loads its
 * config several times in one run, each time with a fresh copy of this
 * module, so the set is kept on the process, and each warning is shown once.
 */
const WARNED: Set<string> = ((globalThis as { vsnapWarned?: Set<string> }).vsnapWarned ??= new Set());

/** The names that a project's `vsnap.config` may have. */
const VIEW_CONFIG_NAMES = ['vsnap.config.ts', 'vsnap.config.mts', 'vsnap.config.js', 'vsnap.config.mjs'];

/** The file that sets each page up before its tests, from this package. */
const SETUP_FILE = resolve(import.meta.dirname, '..', 'browser', `setup${EXTENSION}`);

/** The global setup step that installs the browser if it is missing. */
const INSTALL_BROWSER = resolve(import.meta.dirname, `install-browser${EXTENSION}`);

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
