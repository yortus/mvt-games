import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { vsnap } from 'v-snap/vitest';

const ROOT = import.meta.dirname;

/** The `exports` condition under which each @mvtjs package resolves to its source, so tests need no build of them. */
const SOURCE_CONDITION = '@mvtjs/source';

/** The slow tests' files, which the unit tests leave out. */
const SLOW_TESTS = ['**/*.slow.test.?(c|m)[jt]s?(x)'];

/**
 * The most time a unit test may take, in milliseconds. Most take a few. A
 * test runs about twice as slowly in a full run as alone, and a CI runner
 * is about three times slower again, so CI allows three times as long.
 */
const UNIT_TEST_MS = process.env.CI === 'true' ? 6_000 : 2_000;

/**
 * The unit test files that each need a worker of their own, relative to the
 * root. The files that run in a page, which name a DOM environment in their
 * first lines, such as `// @vitest-environment happy-dom`, are found as the
 * config loads, so in watch mode a new one joins them when Vitest restarts.
 * The rest are listed, with why.
 */
const ISOLATED_TESTS = [
    // It counts the copies of the refresh code that a JSX runtime takes from
    // a pool the module keeps, which other files' JSX tests would take first
    'packages/libraries/utils/src/jsx/create-jsx.test.ts',
];
const DOM_TESTS = globSync('packages/**/*.test.{ts,tsx}', { cwd: ROOT })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !/(^|\/)(node_modules|visual-tests)\/|\.slow\.test\.|^packages\/libraries\/(v-snap|audio90)\//.test(file))
    .filter((file) => /@vitest-environment\s+(happy-dom|jsdom)/.test(readFileSync(resolve(ROOT, file), 'utf8').slice(0, 400)));

// One test run over every workspace in packages/: the unit tests and the slow
// tests in Node, and the visual tests in a browser. Each vsnap() plugin adds the projects for
// one package's visual tests when Vitest starts: `visual-canvas` and
// `visual-html` for the arcade, `visual-demos-*`, `visual-puzzles-*` and
// `visual-kit-*` for the demos, the puzzles and the site kit,
// `visual-playground-html` for the playground,
// and `visual-library-html` for the HTML library's views. They bring
// v-snap's reporter with them. The plugins also leave the visual tests out of
// this config's own projects, `unit`, `unit-isolated` and `slow`. So
// `npm run test:unit` runs the unit tests alone, `-p slow` the slow tests,
// and `vitest run visual-tests/` the
// visual tests, since every visual test file is in a `visual-tests` folder.
// v-snap and audio90 are left out, as if each lived in a repo of its own:
// each one's own config runs its tests, and the scripts call it.
export default defineConfig({
    plugins: [
        // The sites' visual tests, each built with its own Vite config, and the
        // kit's, for the views the sites share, which need nothing beyond this config
        vsnap({ root: resolve(ROOT, 'packages/sites/arcade'), viteConfig: './vite.config.ts' }),
        vsnap({ root: resolve(ROOT, 'packages/sites/demos'), viteConfig: './vite.config.ts', name: 'visual-demos' }),
        vsnap({ root: resolve(ROOT, 'packages/sites/puzzles'), viteConfig: './vite.config.ts', name: 'visual-puzzles' }),
        vsnap({ root: resolve(ROOT, 'packages/sites/site-kit'), name: 'visual-kit' }),
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
        projects: [
            // The unit tests: every test file but the slow ones and the visual
            // ones, in two projects. They are the check to run while working,
            // so each test has a budget, and a test that needs more is made
            // cheaper or moved to the slow tests.
            //
            // `unit` holds the files that run in plain Node. They share their
            // workers' modules rather than each loading its own, which takes
            // the run from about 20 seconds to 12. So a file there must leave
            // no global state changed for the files after it.
            {
                extends: true,
                test: {
                    name: 'unit',
                    exclude: [...SLOW_TESTS, ...DOM_TESTS, ...ISOLATED_TESTS],
                    isolate: false,
                    testTimeout: UNIT_TEST_MS,
                },
            },
            // `unit-isolated` holds the files that each need a worker of their
            // own: those that run in a page, since what a file leaves in a
            // shared page, such as an open dialog, a window listener or the
            // page's own classes, breaks the files after it, and those that
            // count on a module's state from a fresh start.
            {
                extends: true,
                test: {
                    name: 'unit-isolated',
                    include: [...DOM_TESTS, ...ISOLATED_TESTS],
                    testTimeout: UNIT_TEST_MS,
                },
            },
            // The slow tests: whole programs type-checked, every game started,
            // a site built, every case of a puzzle searched. Each file is named
            // `*.slow.test.ts`, usually beside a unit test that checks a sample.
            // CI runs them on every push. Alone: `npm run test:slow`.
            {
                extends: true,
                test: {
                    name: 'slow',
                    include: [...SLOW_TESTS],
                    testTimeout: 120_000,
                },
            },
        ],
    },
});
