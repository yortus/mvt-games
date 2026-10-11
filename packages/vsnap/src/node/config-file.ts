/**
 * A project's `vsnap.config.ts`, which sits at the project's root. The
 * `vsnap` command reads it, and turns it into Vitest's config, so a project
 * never writes a Vitest config for its visual tests.
 *
 * ```ts
 * import { defineConfig } from 'vsnap/config';
 *
 * export default defineConfig({ viteConfig: './vite.config.ts' });
 * ```
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface VsnapConfig {
    /**
     * Globs for the visual test files, relative to the project's root. The
     * default is `DEFAULT_INCLUDE`, the `*.visual.ts` and `*.visual.tsx`
     * files under `src/`.
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
     * view over the budget is drawn at a lower resolution to fit (half, a
     * quarter, and so on). Pixel art and HTML are always drawn at full size,
     * so they fail when over the budget. Images cost storage in every
     * version of every reference, and they cost drawing time. The default is
     * `DEFAULT_MAX_PIXELS`.
     */
    readonly maxPixels?: number;
    /**
     * The project's Vite config, relative to the project's root, for the
     * plugins and aliases that its views need.
     */
    readonly viteConfig?: string;
    /**
     * A module, relative to the project's root, that runs in the test page
     * before the tests. It can call `setViewHooks`, to prepare each view
     * before its image is taken and to dispose of it after.
     */
    readonly setup?: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns the config it is given. It is there so that an editor checks the config's type. */
export function defineConfig(config: VsnapConfig): VsnapConfig {
    return config;
}

/** Loads the `vsnap.config.ts` at a project's root. Throws if there is none. */
export async function loadConfig(root: string): Promise<VsnapConfig> {
    const file = join(root, CONFIG_FILE);
    if (!existsSync(file)) {
        throw new Error(`There is no ${CONFIG_FILE} in ${root}. Run vsnap in a project's root, beside its ${CONFIG_FILE}.`);
    }
    const module = await import(pathToFileURL(file).href) as { default?: VsnapConfig };
    if (module.default === undefined) throw new Error(`${file} has no default export. It should export defineConfig({ ... }).`);
    return module.default;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The file name of a project's config. A folder that holds one is the root of a project. */
export const CONFIG_FILE = 'vsnap.config.ts';
