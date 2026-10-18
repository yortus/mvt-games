import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin } from 'vite';
import { LIBRARIES, LIBRARY_MANIFEST, SANDBOX_RUNNER, toLibraryEntryName } from './libraries/index.ts';
import { exportPackagesPlugin, libraryTypesPlugin } from './scripts/index.ts';

const ROOT = import.meta.dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so the playground needs no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

/** Where the playground is served, from the site's root. */
const PLAYGROUND_PATH = 'playground/';

/** The dev server's port. The Arcade's dev server sends requests for the playground here. */
const DEV_PORT = 5300;

/**
 * Adds the two tags of the page's link preview that need full addresses: the
 * page's own, and its picture's. The picture is the Arcade's card wall, which
 * the Arcade's build writes at this address, from the site's root
 * (packages/sites/arcade/scripts/share-image.ts). `SITE_ORIGIN` names the
 * site's origin, such as `https://example.com`. A build with none, for trying
 * the site out, writes the addresses from the site's root.
 */
function linkPreviewPlugin(): Plugin {
    let base = '/';
    return {
        name: 'link-preview',
        configResolved(config) {
            base = config.base;
        },
        transformIndexHtml() {
            const origin = process.env.SITE_ORIGIN ?? '';
            const siteBase = base.slice(0, -PLAYGROUND_PATH.length);
            const tags: Record<string, string> = {
                'og:url': origin + base,
                'og:image': `${origin}${siteBase}arcade/share.jpg`,
                'og:image:width': '1200',
                'og:image:height': '630',
                'og:image:alt': 'The MVT Arcade\'s wall of cards, one for each game and demo',
            };
            return Object.entries(tags).map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' }));
        },
    };
}

// The playground's page, and a module for each library a project may import
// (`libraries/entries/`), each built as an entry of its own, so the sandbox's
// import map can name it. The build's manifest says which chunk holds each.
// The sandbox's origin is opaque, so every module it loads is a cross-origin
// request: the dev server answers them with CORS headers, as GitHub Pages
// does for the build.
export default defineConfig({
    appType: 'mpa',
    root: ROOT,
    base: (process.env.BASE_URL ?? '/') + PLAYGROUND_PATH,
    publicDir: false,
    // The language service's type bundles: served in development, and written as assets by the build
    plugins: [libraryTypesPlugin(), exportPackagesPlugin(), linkPreviewPlugin()],
    // The language service's worker is built on its own, so it needs the plugin too
    worker: {
        format: 'es',
        plugins: () => [libraryTypesPlugin()],
    },
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    ssr: {
        resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] },
    },
    server: {
        port: DEV_PORT,
        strictPort: true,
        cors: { origin: '*' },
    },
    preview: {
        cors: { origin: '*' },
    },
    build: {
        // After the Arcade's build, which empties dist/
        outDir: resolve(ROOT, '../../../dist', PLAYGROUND_PATH),
        emptyOutDir: true,
        manifest: LIBRARY_MANIFEST,
        rollupOptions: {
            // Each library's module keeps every export, though nothing in the build imports it
            preserveEntrySignatures: 'strict',
            input: {
                index: resolve(ROOT, 'index.html'),
                ...Object.fromEntries([...LIBRARIES.map(toLibraryEntryName), SANDBOX_RUNNER].map((name) => [
                    `library-${name}`,
                    resolve(ROOT, `libraries/entries/${name}.ts`),
                ])),
            },
        },
    },
});
