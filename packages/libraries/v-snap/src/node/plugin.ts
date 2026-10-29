/**
 * `vsnap(options)`, the plugin that adds v-snap's projects to a Vitest run,
 * so that a project's config needs nothing else: `plugins: [vsnap()]`. The
 * config keeps its shape, and `vitest run` runs the unit tests and the
 * visual tests together.
 *
 * - When Vitest starts, the plugin adds v-snap's projects to the run, with
 *   Vitest's `injectTestProjects`, and adds v-snap's reporter.
 * - It keeps the visual test files out of the config's own tests: out of a
 *   flat config's tests, or out of each project that the config lists
 *   inline. A project that the config names by a path or a glob has a
 *   config of its own, which must leave them out itself.
 * - A flat config's tests get the name `unit`, unless the config names
 *   them, so that `vitest -p unit` runs them alone.
 *
 * Vitest calls the plugin through the projects that it starts with, so a
 * `--project` filter that leaves out every one of them leaves out v-snap's
 * projects too. A filter on the files' paths picks the visual tests instead,
 * and the plugin says so when it sees such a `--project` filter.
 */

import { posix, relative, resolve } from 'node:path';
import { configDefaults, type Plugin, type ViteUserConfig } from 'vitest/config';
import { createVsnapProjects, DEFAULT_NAME, type VsnapOptions } from './config.ts';
import { DEFAULT_INCLUDE } from './layout.ts';
import { listProjectFilters, matchesProjectFilter } from './rebundle.ts';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the plugin that adds v-snap's projects to a Vitest run, which a
 * config lists in its `plugins`. It takes the same options as
 * `vsnapProjects()`, and its `root` is relative to Vitest's root, which is
 * also its default.
 */
export function vsnap(options: VsnapOptions = {}): Plugin {
    /** The Vitest instances that have v-snap's projects, so that each gets them once. */
    const added = new WeakSet<object>();
    return {
        name: 'v-snap',
        config: (config) => {
            const test = config.test ?? {};
            if (isOwnProject(test)) return;
            config.test = test;
            if (test.projects === undefined) test.name ??= UNIT_NAME;
            warnOfProjectFilter({ config, options });
        },
        // The root is known only once Vite has resolved the config: when the
        // config hook runs, a root from the command line isn't applied yet.
        configResolved: (resolved) => {
            const test = (resolved as unknown as { test?: TestSettings }).test;
            if (test === undefined || isOwnProject(test)) return;
            leaveOutVisualTests({ test, globs: listVisualGlobs(resolved.root, options) });
        },
        configureVitest: async (context) => {
            if (added.has(context.vitest)) return;
            added.add(context.vitest);
            const { projects, plugin } = createVsnapProjects({ ...options, root: resolve(context.vitest.config.root, options.root ?? '.') });
            await context.injectTestProjects(projects);
            // Vitest calls this hook only for the projects it started with, so
            // the hook of the plugin that v-snap's projects share, which adds
            // the reporter, is called from here.
            const hook = plugin.configureVitest;
            if (typeof hook === 'function') await hook(context);
        },
    };
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Adds the visual test globs to the `exclude` of a config's `test` block,
 * and of each project that it lists inline. Such a project usually shares
 * the config's Vite server, so the plugin's hooks never run for it: Vitest
 * makes its settings from the config as it was written, and the project's
 * own. v-snap's own projects are left alone.
 */
export function leaveOutVisualTests(options: { readonly test: TestSettings; readonly globs: readonly string[] }): void {
    const { test, globs } = options;
    test.exclude = [...(test.exclude ?? configDefaults.exclude), ...globs];
    for (const project of test.projects ?? []) {
        if (!isInlineProject(project)) continue;
        if (project.test !== undefined && isOwnProject(project.test)) continue;
        project.test ??= {};
        project.test.exclude = [...(project.test.exclude ?? configDefaults.exclude), ...globs];
    }
}

/**
 * Warns once if the command line's `--project` filter picks v-snap's
 * projects, but leaves out every project that could add them: the config's
 * own tests, or the projects that it lists inline. Vitest then finds none of
 * v-snap's projects, and says only that no projects matched.
 */
export function warnOfProjectFilter(options: { readonly config: ViteUserConfig; readonly options: VsnapOptions; readonly argv?: readonly string[] }): void {
    const filters = listProjectFilters(options.argv ?? process.argv);
    if (filters === undefined || filters.length === 0) return;
    const hosts = listHostNames(options.config);
    if (hosts === undefined) return;
    const name = options.options.name ?? DEFAULT_NAME;
    const picksVisual = [`${name}-canvas`, `${name}-html`].some((project) => matchesProjectFilter(filters, project));
    if (!picksVisual || hosts.some((host) => matchesProjectFilter(filters, host))) return;
    const key = `project-filter:${name}:${filters.join(' ')}`;
    if (WARNED.has(key)) return;
    WARNED.add(key);
    const filter = filters.map((f) => `--project ${f}`).join(' ');
    const hostList = hosts.length === 1 ? `the ${hosts[0]} project` : `the ${hosts.join(', ')} projects`;
    const globs = (options.options.include ?? DEFAULT_INCLUDE).join(', ');
    console.warn([
        `v-snap: ${filter} leaves out the visual tests.`,
        `The vsnap() plugin adds v-snap's projects through ${hostList}, and this filter leaves ${hosts.length === 1 ? 'it' : 'them'} out.`,
        `- To run only the visual tests, filter by file path instead: vitest run <path>. v-snap finds visual test files with ${globs}.`,
        "- To filter v-snap's projects by name, list them in the config with vsnapProjects() instead of using the plugin.",
    ].join('\n'));
}

/**
 * Returns the names of the projects that carry the plugin, and so could add
 * v-snap's projects: a flat config's tests, or the projects that the config
 * lists inline and that inherit it. It returns undefined when it can't tell,
 * as for a project without a name, or one with a config file of its own.
 */
export function listHostNames(config: ViteUserConfig): string[] | undefined {
    const test = config.test ?? {};
    if (test.projects === undefined) return [toNameText(test.name) ?? UNIT_NAME];
    const names: string[] = [];
    for (const project of test.projects) {
        if (!isInlineProject(project)) return undefined;
        if (project.extends === false || typeof project.extends === 'string') continue;
        const name = toNameText(project.test?.name);
        if (name === undefined) return undefined;
        names.push(name);
    }
    return names;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The settings of a `test` block that the plugin reads and changes. */
interface TestSettings {
    name?: unknown;
    exclude?: string[];
    projects?: unknown[];
    provide?: Record<string, unknown>;
}

/** A project that a config lists inline, as an object, rather than by a path, a glob or a function. */
interface InlineProject {
    extends?: unknown;
    test?: TestSettings;
}

/** The name that a flat config's tests get, unless the config names them. */
const UNIT_NAME = 'unit';

/** Returns a project's name, which Vitest takes as text, or as a label with a colour. */
function toNameText(name: unknown): string | undefined {
    if (typeof name === 'string') return name;
    const label = (name as { label?: unknown } | undefined)?.label;
    return typeof label === 'string' ? label : undefined;
}

/** Returns whether an entry of `test.projects` is a project listed inline. */
function isInlineProject(project: unknown): project is InlineProject {
    return typeof project === 'object' && project !== null && !(project instanceof Promise);
}

/**
 * Returns whether a `test` block is one of v-snap's own projects, which
 * load the config again, plugins included, since they inherit it. Each
 * provides its page's kind to its tests.
 */
function isOwnProject(test: { readonly provide?: unknown }): boolean {
    return (test.provide as { vsnapPageKind?: unknown } | undefined)?.vsnapPageKind !== undefined;
}

/**
 * Returns the globs for the visual test files, relative to the config's
 * root: v-snap's `include` globs, moved to the config's root if v-snap's
 * root is another folder.
 */
function listVisualGlobs(configRoot: string, options: VsnapOptions): string[] {
    const prefix = relative(configRoot, resolve(configRoot, options.root ?? '.')).replaceAll('\\', '/');
    return (options.include ?? DEFAULT_INCLUDE).map((glob) => (prefix === '' ? glob : posix.join(prefix, glob)));
}

/**
 * What this process has warned about. Vitest loads its config several times
 * in one run, each time with a fresh copy of this module, so the set is kept
 * on the process, beside config.ts's own warnings.
 */
const WARNED: Set<string> = ((globalThis as { vsnapWarned?: Set<string> }).vsnapWarned ??= new Set());
