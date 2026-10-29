import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

const ROOT = import.meta.dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so tests need no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

// One test run over every workspace in packages/: the unit tests in Node, and
// the visual tests in a browser. Each vsnap() plugin adds the projects for
// one package's visual tests when Vitest starts: `visual-canvas` and
// `visual-html` for the Arcade, `visual-playground-html` for the playground,
// and `visual-library-html` for the HTML library's views. They bring
// v-snap's reporter with them. The plugins also leave the visual tests out of
// this config's own tests, which they name "unit". So `-p unit` runs the unit
// tests alone, and `vitest run visual-tests/` the visual tests, since every
// visual test file is in a `visual-tests` folder.
// v-snap and audio90 are left out, as if each lived in a repo of its own:
// each one's own config runs its tests, and the scripts call it.
export default defineConfig({
    plugins: [
        // The Arcade's visual tests, which build its views with its own Vite config
        vsnap({ root: resolve(ROOT, 'packages/sites/arcade'), viteConfig: './vite.config.ts' }),
        // The playground's, which need nothing beyond this config
        vsnap({ root: resolve(ROOT, 'packages/sites/playground'), name: 'visual-playground' }),
        // The HTML library's, for the views it offers, such as its Perfmon
        vsnap({ root: resolve(ROOT, 'packages/libraries/html'), name: 'visual-library' }),
    ],
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
        alias: [
            // The playground's examples import `playground` as a project in
            // the playground does. Here it is the module's source.
            { find: /^playground$/, replacement: resolve(ROOT, 'packages/sites/playground/src/project-api/index.ts') },
            // Node resolves solid-js to its server build, where effects never
            // run. Tests get the browser build, as a page does, and Vite loads
            // solid-js and pixi-solid itself so that they share that one copy.
            { find: /^solid-js$/, replacement: resolve(ROOT, 'node_modules/solid-js/dist/solid.js') },
            { find: /^solid-js\/store$/, replacement: resolve(ROOT, 'node_modules/solid-js/store/dist/store.js') },
            { find: /^solid-js\/web$/, replacement: resolve(ROOT, 'node_modules/solid-js/web/dist/web.js') },
        ],
        server: { deps: { inline: ['solid-js', 'pixi-solid'] } },
        // .claude/ holds agent worktrees: separate checkouts, tested on their
        // own. v-snap's and audio90's own tests run in their own configs.
        exclude: [...configDefaults.exclude, '.claude/**', 'packages/libraries/v-snap/**', 'packages/libraries/audio90/**'],
    },
});
