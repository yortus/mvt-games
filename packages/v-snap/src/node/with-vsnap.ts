/**
 * `withVsnap(config)`, which adds v-snap's projects to a Vitest config
 * without the project restructuring it by hand. v-snap's options go in the
 * config, under `vsnap`, so that they can sit beside the call.
 *
 * v-snap's tests run in Vitest projects of their own. A flat config, whose
 * `test` block holds the unit tests' settings, has no projects, so it can't
 * list them. `withVsnap` turns it into one that does: the settings that
 * belong to the unit tests move into a project named `unit`, which leaves
 * out the visual test files, and v-snap's projects follow it. Settings for
 * the whole run, such as `reporters` and `coverage`, and every Vite setting,
 * such as `plugins`, stay where they are, so v-snap's projects inherit the
 * Vite settings, as Vitest's `extends: true` does.
 *
 * A config that has projects already keeps them, and v-snap's projects are
 * added after them. Its projects must leave out the visual test files
 * themselves, as v-snap can't tell which of them would run them.
 */

import { posix, relative, resolve } from 'node:path';
import { type ConfigEnv, configDefaults, type TestProjectInlineConfiguration, type ViteUserConfig, type ViteUserConfigFnPromise } from 'vitest/config';
import { vsnap, type VsnapOptions } from './config.ts';
import { DEFAULT_INCLUDE } from './layout.ts';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a Vitest config with v-snap's projects added to it, from a flat
 * config or one with projects. The config's `vsnap` holds `vsnap()`'s
 * options, and is left out of the config returned. It takes a config
 * function as well as a config object.
 */
export function withVsnap(config: VsnapUserConfig): ViteUserConfig;
export function withVsnap(config: (env: ConfigEnv) => VsnapUserConfig | Promise<VsnapUserConfig>): ViteUserConfigFnPromise;
export function withVsnap(config: VsnapUserConfig | ((env: ConfigEnv) => VsnapUserConfig | Promise<VsnapUserConfig>)): ViteUserConfig | ViteUserConfigFnPromise {
    if (typeof config === 'function') return async (env: ConfigEnv) => addProjects(await config(env));
    return addProjects(config);
}

/** A Vitest config, with v-snap's options. */
export interface VsnapUserConfig extends ViteUserConfig {
    /** v-snap's options, which `vsnap()` takes. */
    readonly vsnap?: VsnapOptions;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The `test` settings of a flat config that belong to its unit tests, and
 * so move into the `unit` project. v-snap's projects inherit the rest. These
 * would send unit tests to v-snap's browser page, keep visual tests out of
 * it, or run Node setup files in it, so v-snap's projects must not inherit
 * them.
 */
const UNIT_SETTINGS = ['name', 'include', 'exclude', 'includeSource', 'environment', 'environmentOptions', 'setupFiles', 'browser'] as const;

/** Returns the config with v-snap's projects added, as `withVsnap` describes. */
function addProjects(withOptions: VsnapUserConfig): ViteUserConfig {
    const { vsnap: options = {}, ...config } = withOptions;
    const test = config.test ?? {};
    const visual = vsnap(options);
    if (test.projects !== undefined) {
        return { ...config, test: { ...test, projects: [...test.projects, ...visual] } };
    }
    const rest: Record<string, unknown> = { ...test };
    const unit: Record<string, unknown> = {};
    for (const key of UNIT_SETTINGS) {
        if (rest[key] === undefined) continue;
        unit[key] = rest[key];
        delete rest[key];
    }
    unit.name ??= 'unit';
    unit.exclude = [...(test.exclude ?? configDefaults.exclude), ...listVisualGlobs(config, options)];
    const unitProject: TestProjectInlineConfiguration = { extends: true, test: unit };
    return { ...config, test: { ...rest, projects: [unitProject, ...visual] } };
}

/**
 * Returns globs for the visual test files, relative to the config's root,
 * for the unit project to leave out. They are v-snap's `include` globs,
 * moved to the config's root if v-snap's root is another folder.
 */
function listVisualGlobs(config: ViteUserConfig, options: VsnapOptions): string[] {
    const configRoot = resolve(config.root ?? process.cwd());
    const vsnapRoot = resolve(options.root ?? process.cwd());
    const prefix = relative(configRoot, vsnapRoot).replaceAll('\\', '/');
    return (options.include ?? DEFAULT_INCLUDE).map((glob) => (prefix === '' ? glob : posix.join(prefix, glob)));
}
