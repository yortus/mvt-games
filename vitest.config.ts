import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

const ROOT = import.meta.dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so tests need no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

// One test run over every workspace in packages/: the unit tests in Node, and
// the Arcade's and the playground's visual tests in a browser. The "unit"
// project leaves out the visual tests, which run in v-snap's projects:
// `visual-canvas` and `visual-html` for the Arcade, and
// `visual-playground-html` for the playground. They bring v-snap's reporter
// with them. `-p unit` and `-p "visual-*"` run each kind alone. v-snap is
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
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    // .claude/ holds agent worktrees: separate checkouts, tested
                    // on their own. v-snap's own tests run in its own config.
                    // The visual tests run in v-snap's projects.
                    exclude: [...configDefaults.exclude, '.claude/**', 'packages/tools/v-snap/**', '**/visual-tests/*.test.{ts,tsx}'],
                },
            },
            // The Arcade's visual tests, which build its views with its own Vite config
            ...vsnap({
                root: resolve(ROOT, 'packages/sites/arcade'),
                viteConfig: './vite.config.ts',
            }),
            // The playground's, which need nothing beyond this config
            ...vsnap({
                root: resolve(ROOT, 'packages/sites/playground'),
                name: 'visual-playground',
            }),
        ],
    },
});
