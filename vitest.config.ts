import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

const ROOT = __dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so tests need no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

// One test run over every workspace in packages/, the website and the checks included.
export default defineConfig({
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    // Tests in Node resolve as the server does
    ssr: {
        resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] },
    },
    test: {
        // .claude/ holds agent worktrees: separate checkouts, tested on their own
        exclude: [...configDefaults.exclude, '.claude/**'],
        // Node resolves solid-js to its server build, where effects never
        // run. Tests get the browser build, as a page does, and Vite loads
        // solid-js and pixi-solid itself so that they share that one copy.
        alias: [
            { find: /^solid-js$/, replacement: resolve(ROOT, 'node_modules/solid-js/dist/solid.js') },
            { find: /^solid-js\/store$/, replacement: resolve(ROOT, 'node_modules/solid-js/store/dist/store.js') },
            { find: /^solid-js\/web$/, replacement: resolve(ROOT, 'node_modules/solid-js/web/dist/web.js') },
        ],
        server: { deps: { inline: ['solid-js', 'pixi-solid'] } },
    },
});
