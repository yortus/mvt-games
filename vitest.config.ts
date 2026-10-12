import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
// vsnap's Node side, from its source. Node loads the packages that a config
// imports, and Node doesn't know the source condition, so `vsnap/config`
// would need vsnap built first.
import { vsnap } from './packages/vsnap/src/node/index.ts';

const ROOT = __dirname;

/** The `exports` condition under which each @mvtjs package, and vsnap, resolves to its source, so tests need no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

// The website's visual tests, in vsnap's projects, `visual-canvas` and
// `visual-html`, which bring vsnap's reporter with them. `-p "visual-*"`
// runs them.
const website = vsnap({
    root: resolve(ROOT, 'packages/website'),
    viteConfig: './vite.config.ts',
});

// One test run over every workspace in packages/: the unit tests in Node, in
// the "unit" project, and the website's visual tests in a browser. vsnap is
// left out, as if it lived in a repo of its own: its own config runs its
// tests, and the scripts call it.
export default defineConfig({
    resolve: {
        conditions: [SOURCE_CONDITION, ...defaultClientConditions],
    },
    // Tests in Node resolve as the server does
    ssr: {
        resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] },
    },
    test: {
        reporters: [
            'default',
            ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions' as const] : []),
        ],
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    // .claude/ holds agent worktrees: separate checkouts, tested on
                    // their own. Visual tests run in vsnap's projects, and vsnap's
                    // own tests in its own config.
                    exclude: [...configDefaults.exclude, '.claude/**', 'packages/vsnap/**', '**/*.visual.test.{ts,tsx}'],
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
            },
            ...website,
        ],
    },
});
