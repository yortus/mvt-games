import { existsSync, globSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { EnvironmentModuleNode, Plugin, ViteDevServer } from 'vite';
import { isVisualTestFile } from './find-visual-tests.ts';
import { instrumentKnobs } from './instrument-knobs.ts';
import { instrumentTunings } from './instrument-tunings.ts';
import { createPreviewApi } from './preview-api.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ViewPreviewPluginOptions {
    /** The folder of the package whose visual tests the preview shows, which holds its `vsnap.config.ts`. */
    readonly packageRoot: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the Vite plugin that serves the preview page at `<base>__view-preview/`,
 * beside a package's own pages. It does five things to the package's code,
 * in the preview's server only:
 *
 * - `v-snap` becomes a stand-in that records each test's name, options and
 *   pose, instead of declaring a Vitest test, and `vitest` becomes a
 *   stand-in whose `describe` names the tests inside it.
 * - Each literal in a pose becomes a knob (see `instrumentKnobs`).
 * - Each tuning object, a top-level `const` named `*_TUNING` in any module,
 *   registers with the page as it's created, so the page can change its
 *   fields (see `instrumentTunings`).
 * - `advanceTime` reports the models it advances, so the preview can keep
 *   them running after the pose returns its view.
 * - `virtual:view-preview/test-files` lists the package's visual test files,
 *   and `virtual:view-preview/vsnap-config` is its `vsnap.config.ts`.
 *
 * It also answers the page's requests to add a snapshot test and write its
 * reference image, and to list the tuning objects that a test file imports,
 * however indirectly (see `createPreviewApi`).
 */
export function viewPreviewPlugin(options: ViewPreviewPluginOptions): Plugin {
    const packageRoot = toUpperCaseDrive(options.packageRoot);
    const pageDir = toUpperCaseDrive(resolve(import.meta.dirname, '../page'));
    const toUrlPath = (path: string): string => path.replaceAll('\\', '/');
    const vsnapConfig = resolve(packageRoot, 'vsnap.config.ts');
    let base = '/';
    /** The tuning objects each module declares, by its path, as Vite names the module's file. */
    const tuningsByFile = new Map<string, readonly string[]>();
    return {
        name: 'view-preview',
        enforce: 'pre',
        config: () => ({
            resolve: {
                alias: [
                    { find: /^v-snap$/, replacement: resolve(pageDir, 'vsnap-stand-in.ts') },
                    { find: /^vitest$/, replacement: resolve(pageDir, 'vitest-stand-in.ts') },
                ],
            },
        }),
        configResolved: (config) => {
            base = config.base;
        },
        resolveId: (id) => (id === TEST_FILES_ID ? `\0${TEST_FILES_ID}` : id === CONFIG_ID ? (existsSync(vsnapConfig) ? vsnapConfig : `\0${CONFIG_ID}`) : undefined),
        load: (id) => {
            if (id === `\0${TEST_FILES_ID}`) {
                const files = globSync('src/**/visual-tests/*.test.{ts,tsx}', { cwd: packageRoot }).sort().map((file) => ({
                    path: toUrlPath(file).replace(/^src\//, ''),
                    url: `${base}@fs/${toUrlPath(resolve(packageRoot, file))}`,
                }));
                return `export default ${JSON.stringify(files)};`;
            }
            if (id === `\0${CONFIG_ID}`) return 'export default { views: [] };';
            return undefined;
        },
        transform: (code, id) => {
            const path = id.split('?')[0];
            if (isVisualTestFile(path)) {
                const instrumented = instrumentKnobs({ code, fileName: path, runtimeModule: toUrlPath(resolve(pageDir, 'knobs.ts')) });
                return instrumented === undefined ? undefined : { code: instrumented.code, map: instrumented.map };
            }
            if (isTuningCandidate({ path, code, pageDir })) {
                const instrumented = instrumentTunings({ code, fileName: path, runtimeModule: toUrlPath(resolve(pageDir, 'tunings.ts')) });
                if (instrumented === undefined) tuningsByFile.delete(path);
                else tuningsByFile.set(path, instrumented.tunings.map((tuning) => tuning.id));
                return instrumented === undefined ? undefined : { code: instrumented.code, map: instrumented.map };
            }
            if (path.endsWith(ADVANCE_TIME_FILE)) {
                if (!ADVANCE_TIME_HOOK_AT.test(code)) throw new Error(`The preview couldn't find where to hook advanceTime in ${relative(process.cwd(), path)}.`);
                return code.replace(ADVANCE_TIME_HOOK_AT, (found) => `${ADVANCE_TIME_HOOK}\n${found}`);
            }
            return undefined;
        },
        configureServer: (server) => {
            server.middlewares.use(createPreviewApi({
                packageRoot,
                path: `${base}${PAGE}/api/`,
                toFileUrl: (file) => `${base}@fs/${toUrlPath(file)}`,
                findTunings: (file) => findImportedTunings({ server, file: toUrlPath(file), tuningsByFile }),
            }));
            server.middlewares.use((request, response, next) => {
                const path = request.url?.split('?')[0];
                if (path !== `${base}${PAGE}` && path !== `${base}${PAGE}/`) return next();
                // transformIndexHtml puts the base before the page's own URLs
                const html = pageHtml(`/@fs/${toUrlPath(resolve(pageDir, 'main.ts'))}`);
                server.transformIndexHtml(request.url ?? '/', html).then((transformed) => {
                    response.setHeader('Content-Type', 'text/html');
                    response.end(transformed);
                }, next);
            });
        },
    };
}

/** The page's path under the server's base. */
export const PAGE = '__view-preview';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEST_FILES_ID = 'virtual:view-preview/test-files';
const CONFIG_ID = 'virtual:view-preview/vsnap-config';

const ADVANCE_TIME_FILE = '/libraries/utils/src/advance-time.ts';

/** Where in `advanceTime` the models are known, and the steps haven't started. */
const ADVANCE_TIME_HOOK_AT = /\n\s*let remaining = ms;/;
const ADVANCE_TIME_HOOK = '    (globalThis as { __viewPreview?: { noteAdvanced: (models: readonly unknown[]) => void } }).__viewPreview?.noteAdvanced(models);';

/**
 * Returns whether a module may declare tuning objects. That's a module of
 * the repo's own, other than a visual test file or one of the preview's own,
 * that mentions `_TUNING`, which is a quick way to pass over the rest.
 */
function isTuningCandidate(options: { readonly path: string; readonly code: string; readonly pageDir: string }): boolean {
    const { path, code, pageDir } = options;
    return /\.tsx?$/.test(path)
        && !path.includes('/node_modules/')
        && !path.startsWith(pageDir.replaceAll('\\', '/'))
        && !isVisualTestFile(path)
        && code.includes('_TUNING');
}

/**
 * Returns the tuning objects a test file imports, directly or through the
 * modules it imports, as Vite's module graph has them. The page has loaded
 * the file by then, so Vite has followed each of its imports.
 */
function findImportedTunings(options: { readonly server: ViteDevServer; readonly file: string; readonly tuningsByFile: ReadonlyMap<string, readonly string[]> }): readonly string[] {
    const { server, file, tuningsByFile } = options;
    const found: string[] = [];
    const seen = new Set<EnvironmentModuleNode>();
    const queue = [...(server.environments.client.moduleGraph.getModulesByFile(file) ?? [])];
    while (queue.length > 0) {
        const module = queue.pop()!;
        if (seen.has(module)) continue;
        seen.add(module);
        if (module.file !== null) found.push(...(tuningsByFile.get(module.file) ?? []));
        for (const imported of module.importedModules) queue.push(imported);
    }
    return found.sort();
}

function pageHtml(mainUrl: string): string {
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head><meta charset="utf-8"><title>View preview</title></head>',
        '<body>',
        `<script type="module" src="${mainUrl}"></script>`,
        '</body>',
        '</html>',
    ].join('\n');
}

/** Returns `path` with its drive letter in upper case, as the sites' Vite configs do, so that Vite sees one file as one module. */
function toUpperCaseDrive(path: string): string {
    return path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}
