/**
 * v-snap's Vitest projects, which run beside a project's unit tests. The
 * `vsnap()` plugin adds them to a run (see plugin.ts), and
 * `vsnapProjects(options)` returns them, for a config that lists its
 * projects itself. Either way, there are two, which bring v-snap's reporter
 * with them.
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
 * The name is `visual` by default. Each project gets its files from the
 * declarations in them, read when the config loads. So in watch mode,
 * v-snap restarts Vitest when a visual test file is added or deleted.
 *
 * Both run in Playwright's headless shell, a small build of Chromium for
 * headless use. It is launched with one fixed value for every setting that
 * differs between machines. A global setup step installs it if it is
 * missing, before the browser starts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, type Plugin, type TestProjectInlineConfiguration } from 'vitest/config';
import type { Reporter } from 'vitest/node';
import type { ColorScheme, PageKind } from '../protocol.ts';
import { createRunState, createVisualCommands } from './commands.ts';
import { createLayout } from './layout.ts';
import { toDisplayPath } from './paths.ts';
import { forgetFingerprint, isLeftOutByCommandLine, mustRebundle, recordFingerprint } from './rebundle.ts';
import { registerRoot, toFileKey } from './references.ts';
import { createVisualReporter } from './reporter.ts';
import { claimTestFiles, describeProblems, escapeGlob, findVisualTestFiles, type VisualTestFiles } from './test-files.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VsnapOptions {
    /**
     * The start of the projects' names, which end in `-canvas` and `-html`.
     * The default is `visual`.
     */
    readonly name?: string;
    /**
     * The folder that holds the visual tests and `vsnap.config.ts`, which the
     * other paths are relative to. For the `vsnap()` plugin, a relative root
     * is relative to Vitest's root, which is also the default. For
     * `vsnapProjects()`, the default is the folder that Vitest runs in.
     */
    readonly root?: string;
    /**
     * Globs for the visual test files, relative to the root. The default is
     * `DEFAULT_INCLUDE`, the `*.test.ts` and `*.test.tsx` files in
     * `visual-tests` folders.
     */
    readonly include?: readonly string[];
    /**
     * Globs for files that `include` matches but that aren't visual test
     * files, relative to the root, such as a folder of fixtures. By default,
     * there are none.
     */
    readonly exclude?: readonly string[];
    /**
     * Where each reference image is kept, as a path template relative to the
     * root. The variables are `{testFileDir}`, `{testFileName}`,
     * `{testFileStem}`, `{testFilePath}` and `{imageName}`. `{imageName}`
     * must appear once, in the file name, which ends in `.png`. The default
     * is `DEFAULT_REFERENCE_PATH`: beside each test file, named for the
     * file's stem and the image.
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
     * where the rest of v-snap's settings are.
     */
    readonly vsnapConfig?: string;
    /**
     * The test page's viewport, in CSS pixels. An HTML view must fit inside
     * it, and a test's own `viewport` can't be bigger. The default is
     * `DEFAULT_VIEWPORT`, 1280 by 800.
     */
    readonly viewport?: { readonly width: number; readonly height: number };
    /**
     * The colour scheme that the page's `prefers-color-scheme` media queries
     * see, unless a test's own `colorScheme` says otherwise. The default is
     * `dark`.
     */
    readonly colorScheme?: ColorScheme;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The default size budget, which is about a 960 by 540 screen. */
export const DEFAULT_MAX_PIXELS = 500_000;

/** The test page's default viewport, in CSS pixels. */
export const DEFAULT_VIEWPORT: { readonly width: number; readonly height: number } = { width: 1280, height: 800 };

/** The default start of the projects' names. */
export const DEFAULT_NAME = 'visual';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the Vitest projects for a project's visual tests, `<name>-canvas`
 * and `<name>-html`, which the config lists in `test.projects`. They bring
 * v-snap's reporter with them, which prints the visual tests' summary. After
 * a complete run, it also checks every reference image, and handles the
 * reference images that no test used. The config's other projects must
 * leave out the visual test files themselves.
 */
export function vsnapProjects(options: VsnapOptions = {}): TestProjectInlineConfiguration[] {
    return createVsnapProjects(options).projects;
}

/**
 * Returns v-snap's projects, and the plugin that they share. Vitest calls
 * the plugin's `configureVitest` for each project that it starts with, which
 * adds v-snap's reporter to the run. The `vsnap()` plugin adds the projects
 * once the run has started, so Vitest never calls it for them, and the
 * `vsnap()` plugin calls it instead.
 */
export function createVsnapProjects(options: VsnapOptions): { projects: TestProjectInlineConfiguration[]; plugin: Plugin } {
    const root = resolve(options.root ?? process.cwd());
    const name = options.name ?? DEFAULT_NAME;
    const layout = createLayout({ root, include: options.include, exclude: options.exclude, referencePath: options.referencePath });
    registerRoot(root);
    const files = findVisualTestFiles(layout);
    warnOfProblems(files.problems);
    claimTestFiles(name, [...files.canvas, ...files.html].map((file) => ({ key: toFileKey(resolve(root, file)), file: resolve(root, file) })));
    const state = createRunState();
    const commands = createVisualCommands({ layout, state });
    // A kind of page with no test files gets no project.
    const pageKinds = (['canvas', 'html'] as const).filter((pageKind) => files[pageKind].length > 0);
    const projectNames = pageKinds.map((pageKind) => `${name}-${pageKind}`);
    const viewConfig = findViewConfig(root, options.vsnapConfig);
    if (viewConfig !== undefined) checkViewConfig(viewConfig);
    const allFiles = [...files.canvas, ...files.html];
    const reporter = createVisualReporter({
        layout,
        state,
        projectNames,
        testFiles: allFiles.map((file) => resolve(root, file)),
        problems: files.problems,
    });
    const plugin = createVsnapPlugin({ reporter, name, root, isDefaultRoot: options.root === undefined, files: () => findVisualTestFiles(layout), initialFiles: files });
    // A run that leaves the projects out never bundles for them.
    const rebundle = isLeftOutByCommandLine(projectNames) ? false : mustRebundle({ name, root });
    const projects = pageKinds.map((pageKind, i) => createVisualProject({
        rebundle,
        root,
        name: projectNames[i],
        pageKind,
        files: files[pageKind],
        commands,
        viewConfig,
        plugin,
        maxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS,
        viewport: options.viewport ?? DEFAULT_VIEWPORT,
        colorScheme: options.colorScheme ?? 'dark',
        viteConfig: options.viteConfig,
    }));
    return { projects, plugin };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Creates the Vitest project for one kind of page. */
function createVisualProject(options: {
    /** Whether Vite must bundle the libraries afresh, since the sources changed. */
    readonly rebundle: boolean;
    readonly root: string;
    readonly maxPixels: number;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly colorScheme: ColorScheme;
    readonly viteConfig: string | undefined;
    readonly name: string;
    readonly pageKind: PageKind;
    readonly files: readonly string[];
    readonly commands: ReturnType<typeof createVisualCommands>;
    /** The project's `vsnap.config.ts`, if it has one. */
    readonly viewConfig: string | undefined;
    /** The plugin that the projects of one `vsnap` call share. */
    readonly plugin: Plugin;
}): TestProjectInlineConfiguration {
    const isHtml = options.pageKind === 'html';
    const files = options.files;
    const setupFiles = [SETUP_FILE];
    // The scan's globs are relative to the root.
    const viewConfig = options.viewConfig === undefined ? [] : [escapeGlob(relative(options.root, options.viewConfig).replaceAll('\\', '/'))];
    const test = {
        name: options.name,
        // Each file is a glob to Vitest, so its name is escaped.
        include: files.map(escapeGlob),
        // The project runs one file at a time, so it needs a group of its
        // own, after the projects that run several at once. Its tests never
        // run concurrently, whatever the config they inherit says, since
        // they share a page.
        sequence: { groupOrder: GROUP_ORDER, concurrent: false },
        globalSetup: [INSTALL_BROWSER],
        // An HTML view's stylesheet stays in the page once it is imported,
        // so each HTML file gets a fresh page.
        isolate: isHtml,
        fileParallelism: false,
        setupFiles,
        testTimeout: 30_000,
        provide: {
            vsnapPageKind: options.pageKind,
            vsnapMaxPixels: options.maxPixels,
            vsnapHasConfig: options.viewConfig !== undefined,
            vsnapConfigFile: toDisplayPath(options.viewConfig ?? join(options.root, VIEW_CONFIG_NAMES[0])),
            vsnapViewport: options.viewport,
            vsnapColorScheme: options.colorScheme,
        },
        browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            dependencySourcemaps: false,
            viewport: options.viewport,
            provider: playwright({
                launchOptions: { args: BROWSER_ARGS },
                contextOptions: { locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1, colorScheme: options.colorScheme, reducedMotion: 'reduce' },
            }),
            // Named, so that the project's name has no "(chromium)" after it.
            instances: [{ browser: 'chromium', name: options.name }],
            commands: options.commands,
        },
    } satisfies TestProjectInlineConfiguration['test'];
    return {
        root: options.root,
        plugins: [options.plugin, createOwnSettingsPlugin(test)],
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
        // v-snap itself is never bundled. The setup file loads v-snap's page
        // code by path, so a bundled copy for the tests would be a second
        // copy, and it would hold a copy of the project's vsnap.config.ts.
        // So Vite can't scan v-snap's code for the libraries it imports, and
        // they are named instead.
        optimizeDeps: {
            entries: [...files.map(escapeGlob), ...setupFiles.map((file) => escapeGlob(file.replaceAll('\\', '/'))), ...viewConfig],
            exclude: [...PACKAGE_ENTRIES],
            include: ['v-snap > fontkit', ...RENDERERS.filter((name) => isInstalled(name, options.root))],
            force: options.rebundle,
        },
        test,
    };
}

/**
 * Returns the plugin that gives a visual project its own settings back, in
 * place of those that it inherits. A project that inherits a config
 * (`extends: true`) loads it again, and Vite merges the config's `test`
 * block into the project's own, joining lists. So without the plugin, the
 * project would get the unit tests' files, their setup files, which would
 * run in the browser page, their environment, and their browser settings,
 * which would run each visual test again in a browser that v-snap didn't set
 * up. Vitest reads `test` once Vite has resolved the config, so the plugin
 * puts the project's own settings back then. The project inherits the rest,
 * such as `alias` and `server`, as the unit tests' views need them too.
 */
function createOwnSettingsPlugin(own: { readonly include: readonly string[]; readonly setupFiles: readonly string[]; readonly browser: object }): Plugin {
    return {
        name: 'v-snap:own-settings',
        configResolved: (resolved) => {
            const test = (resolved as unknown as { test?: Record<string, unknown> }).test;
            if (test === undefined) return;
            test.include = [...own.include];
            test.exclude = [...configDefaults.exclude];
            test.setupFiles = [...own.setupFiles];
            test.browser = own.browser;
            for (const key of UNIT_ONLY_SETTINGS) delete test[key];
        },
    };
}

/** The settings of a config's `test` block that belong to its unit tests, and that a visual project leaves out. */
const UNIT_ONLY_SETTINGS = ['includeSource', 'environment', 'environmentOptions'] as const;

/**
 * Returns the plugin that the projects of one `vsnap` call share. Vitest
 * calls its `configureVitest` for each project, before it makes its
 * reporters, and again after each restart.
 *
 * - It adds v-snap's reporter to the run, once, so that a project needn't
 *   add it. A run that filters out v-snap's projects has no reporter of
 *   v-snap's.
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
    /** Whether the root is the default, the folder that Vitest runs in. */
    readonly isDefaultRoot: boolean;
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
        name: 'v-snap',
        configureVitest: ({ vitest }) => {
            const reporters = vitest.config.reporters as unknown[];
            if (!reporters.includes(options.reporter)) reporters.push(options.reporter);
            // The projects run, and so bundle, in this run.
            recordFingerprint({ name: options.name, root: options.root });
            // The projects found their files when the config loaded, from the
            // folder Vitest runs in, before Vitest's own root was known.
            if (options.isDefaultRoot && toFileKey(vitest.config.root) !== toFileKey(options.root)) {
                throw new Error(
                    `v-snap's root is the folder that Vitest runs in, ${toDisplayPath(options.root)}, but Vitest's own root is ${toDisplayPath(vitest.config.root)}, `
                    + 'as `vitest --root`, or a config in another folder, sets it. Give v-snap the root yourself, such as vsnapProjects({ root: import.meta.dirname }).',
                );
            }
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
                    console.warn(`v-snap: couldn't read the visual test files after ${file} changed, so it kept the files it had: ${error instanceof Error ? error.message : String(error)}`);
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

/** Returns the paths of the files that match the globs, test files or not. */
function listKnownFiles(files: VisualTestFiles): Set<string> {
    return new Set([...files.canvas, ...files.html, ...files.problems.map((p) => p.file)]);
}

/**
 * Warns once about each visual test file that can't run. The run fails over
 * them only when v-snap's projects run, through the reporter, so a run of
 * the project's other tests, or a tool that lists the tests, isn't stopped
 * by a file that is half written.
 */
function warnOfProblems(problems: VisualTestFiles['problems']): void {
    const fresh = problems.filter((p) => !WARNED.has(`${p.file}: ${p.problem}`));
    if (fresh.length === 0) return;
    for (const p of fresh) WARNED.add(`${p.file}: ${p.problem}`);
    console.warn(`v-snap: ${describeProblems(fresh)}`);
}

/**
 * Returns the path of a project's `vsnap.config`: the one that the
 * `vsnapConfig` option names, or the one in its root, if it has one. It
 * throws if the option names a file that doesn't exist.
 */
function findViewConfig(root: string, named: string | undefined): string | undefined {
    if (named !== undefined) {
        const path = resolve(root, named);
        if (!existsSync(path)) throw new Error(`v-snap's vsnapConfig option names ${toDisplayPath(path)}, which doesn't exist.`);
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
 * which v-snap reads. It warns if the file mentions neither `Register` nor
 * `bindCanvasTest`, since then TypeScript doesn't know the file's kinds of
 * view, and rejects every test of those kinds.
 */
function checkViewConfig(file: string): void {
    const text = readFileSync(file, 'utf8');
    // `export default config`, or `export { config as default }`.
    if (!/\bexport\s+default\b|\bas\s+default\b/.test(text)) {
        throw new Error(`${toDisplayPath(file)} has no default export. v-snap reads the config from it, so export the config as the default: export default defineVsnapConfig({ ... }).`);
    }
    if (!/\b(?:Register|bindCanvasTest)\b/.test(text) && !WARNED.has(file)) {
        WARNED.add(file);
        console.warn(
            `v-snap: TypeScript doesn't know which kinds of view ${toDisplayPath(file)} registers, so canvasTest will reject tests of those kinds. Add this to the file:\n`
            + "    declare module 'v-snap' {\n        interface Register {\n            config: typeof config;\n        }\n    }\n"
            + 'In a monorepo where each package has its own config, export bindCanvasTest(config) from each config instead, and import canvasTest from there.',
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
const PACKAGE_ENTRIES = ['v-snap', 'v-snap/pixi', 'v-snap/three'];

/** The libraries that v-snap's support for Pixi and three.js imports, which a project installs if it uses them. */
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

/**
 * The group that v-snap's projects run in. Vitest runs groups in order, and
 * projects that share a group must share how many files run at once. A
 * project's own projects are in group 0 unless it says otherwise, and some
 * use 1, 2 and so on, so v-snap's group is well past them, and its projects
 * run after them.
 */
const GROUP_ORDER = 1000;

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
