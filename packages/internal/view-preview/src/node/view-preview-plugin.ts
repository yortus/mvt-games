import { existsSync, globSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { isVisualTestFile } from './find-visual-tests.ts';
import { instrumentKnobs } from './instrument-knobs.ts';
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
 * beside a package's own pages. It does four things to the package's code,
 * in the preview's server only:
 *
 * - `v-snap` becomes a stand-in that records each test's name, options and
 *   pose, instead of declaring a Vitest test, and `vitest` becomes a
 *   stand-in whose `describe` names the tests inside it.
 * - Each literal in a pose becomes a knob (see `instrumentKnobs`).
 * - `advanceTime` reports the models it advances, so the preview can keep
 *   them running after the pose returns its view.
 * - `virtual:view-preview/test-files` lists the package's visual test files,
 *   and `virtual:view-preview/vsnap-config` is its `vsnap.config.ts`.
 *
 * It also answers the page's requests to add a snapshot test and write its
 * reference image (see `createPreviewApi`).
 */
export function viewPreviewPlugin(options: ViewPreviewPluginOptions): Plugin {
    const packageRoot = toUpperCaseDrive(options.packageRoot);
    const pageDir = toUpperCaseDrive(resolve(import.meta.dirname, '../page'));
    const toUrlPath = (path: string): string => path.replaceAll('\\', '/');
    const vsnapConfig = resolve(packageRoot, 'vsnap.config.ts');
    let base = '/';
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
            if (path.endsWith(ADVANCE_TIME_FILE)) {
                if (!ADVANCE_TIME_HOOK_AT.test(code)) throw new Error(`The preview couldn't find where to hook advanceTime in ${relative(process.cwd(), path)}.`);
                return code.replace(ADVANCE_TIME_HOOK_AT, (found) => `${ADVANCE_TIME_HOOK}\n${found}`);
            }
            return undefined;
        },
        configureServer: (server) => {
            server.middlewares.use(createPreviewApi({ packageRoot, path: `${base}${PAGE}/api/`, toFileUrl: (file) => `${base}@fs/${toUrlPath(file)}` }));
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
