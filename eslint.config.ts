import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
// This repo's own rules, from their source, through the root package.json's
// `imports`. ESLint loads this config, and what it imports, through jiti,
// which compiles TypeScript as it loads it, so nothing needs building first.
// The package's own name would resolve to its build: jiti reads `exports`
// with only the `node` and `import` conditions, never `@mvtjs/source`.
import mvt from '#eslint-plugin';

// The playground's examples: small projects, written as an entry's code is,
// and linted by the same rules.
const PLAYGROUND_EXAMPLES = 'packages/sites/playground/examples/**/*.{ts,tsx}';

// Views are `XxxView(bindings)` functions, query bindings have no `get` prefix,
// and types use function-valued properties.
const VIEW_CONVENTION_FILES = [
    'packages/*/*/src/**/*.{ts,tsx}',
    PLAYGROUND_EXAMPLES,
];

// No module imports its own barrel or an ancestor's (`.`, `..`, `../..`,
// `./index` and the like): inside a directory, import the file directly
// (packages/sites/docs/reference/project-structure.md).
const OWN_BARREL_IMPORT = {
    regex: '^\\.{1,2}(/\\.\\.)*(/index)?/?$',
    message: 'Import the file directly, not your own or an ancestor\'s barrel (packages/sites/docs/reference/project-structure.md).',
};

// The tick API a renderer package re-exports from @mvtjs/utils. Code that uses
// a renderer imports these from it: one place to import each from, an import
// that also loads the renderer, which registers its views with `updateView`
// and declares their type in `View`, and the same copy of @mvtjs/utils that
// the renderer was built against.
const TICK_API_FROM_RENDERER = {
    name: '@mvtjs/utils',
    importNames: [
        'updateView', 'refreshView', 'setUpdate', 'setRefresh', 'hasUpdate', 'hasRefresh', 'SKIP_DESCENDANTS', 'advanceTime',
        'addReads', 'countTick', 'tickCounter',
        'UpdateMethod', 'RefreshMethod', 'TickCounter', 'TickCounts', 'View', 'Advanceable',
    ],
    message: 'Import this from the renderer package (@mvtjs/pixi, @mvtjs/three or @mvtjs/html), which re-exports it.',
};

// Files that may import a package's devDependencies: tests, spikes, scripts,
// benchmarks and config. Library source may import only its dependencies and
// peer dependencies.
const DEV_FILES = [
    '**/*.test.{ts,tsx}',
    '**/*.spike.{ts,tsx}',
    '**/scripts/**',
    'packages/tests/benchmarks/**',
    'packages/sites/docs/**',
    '**/*.config.{ts,js}',
];

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    stylistic.configs.customize({
        indent: 4,
        quotes: 'single',
        semi: true,
        jsx: true,
    }),
    {
        files: ['**/*.{ts,tsx,js,mjs,cjs}'],
        plugins: {
            '@stylistic': stylistic,
            'import': importPlugin,
        },
        rules: {
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/no-multi-spaces': 'off',
            '@stylistic/operator-linebreak': ['error', 'before', {
                overrides: {
                    '=': 'after',
                    '+=': 'after',
                    '-=': 'after',
                    '*=': 'after',
                    '/=': 'after',
                    '%=': 'after',
                    '**=': 'after',
                    '&&=': 'after',
                    '||=': 'after',
                    '??=': 'after',
                },
            }],
            '@stylistic/quote-props': ['error', 'consistent'],
            // Function members in types as properties, not methods: stricter
            // parameter checks, and nothing here uses `this`. See the style guide.
            '@typescript-eslint/method-signature-style': ['error', 'property'],
            // Allow underscore-prefixed unused parameters
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        // Each package's scripts, fixtures and root config files too.
        files: ['packages/*/*/src/**/*.{ts,tsx}', 'packages/*/*/{scripts,fixtures}/**/*.{ts,tsx}', 'packages/*/*/*.config.ts', PLAYGROUND_EXAMPLES],
        plugins: {
            '@mvtjs': mvt,
        },
        rules: {
            // Enforce barrel imports: no reaching past a folder's index.ts, or
            // into a package that has no `exports` field. A package's
            // `exports` field, and its `imports` for `#shared` and the like,
            // are checked by TypeScript.
            '@mvtjs/no-deep-imports': 'error',
            'no-restricted-imports': ['error', { patterns: [OWN_BARREL_IMPORT] }],
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: ['./packages/*/*/tsconfig.json'],
                    noWarnOnMultipleProjects: true,
                },
            },
        },
    },
    {
        // A package's config files are loaded by Node itself, which imports a
        // file, not a folder. So they import a folder's barrel by its index
        // file, such as `./scripts/index.ts`.
        files: ['packages/*/*/*.config.ts'],
        rules: {
            '@mvtjs/no-deep-imports': ['error', { allowIndexFile: true }],
        },
    },
    {
        files: ['packages/sites/arcade/src/**/*.{ts,tsx}', 'packages/sites/playground/src/**/*.{ts,tsx}', PLAYGROUND_EXAMPLES],
        rules: {
            'no-restricted-imports': ['error', { patterns: [OWN_BARREL_IMPORT], paths: [TICK_API_FROM_RENDERER] }],
        },
    },
    {
        files: ['packages/tests/benchmarks/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', { paths: [TICK_API_FROM_RENDERER] }],
        },
    },
    {
        // The playground and the rest of the site share no code, so either
        // could move to a package of its own without untangling them.
        files: ['packages/sites/arcade/src/**/*.{ts,tsx}'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/no-restricted-paths': ['error', {
                zones: [
                    {
                        target: './packages/sites/arcade/src/playground',
                        from: './packages/sites/arcade/src',
                        except: ['./playground'],
                        message: 'The playground shares no code with the rest of the site.',
                    },
                    {
                        target: ['./packages/sites/arcade/src/!(playground)/**', './packages/sites/arcade/src/*.{ts,tsx}'],
                        from: './packages/sites/arcade/src/playground',
                        message: 'The rest of the site shares no code with the playground.',
                    },
                ],
            }],
        },
    },
    {
        files: VIEW_CONVENTION_FILES,
        // The playground builds DOM and CodeMirror views, and its presets follow
        // the sandbox's own `createView(model)` contract.
        ignores: ['packages/sites/arcade/src/playground/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSInterfaceDeclaration[id.name=/(ViewBindings|ViewModel|ViewModelOptions)$/] TSPropertySignature[key.name=/^get[A-Z]/]',
                    message: 'Name a query binding, or a view model member or option, for what it returns, without a `get` prefix. See the style guide, "Views and Bindings".',
                },
                {
                    selector: 'FunctionDeclaration[id.name=/^create[A-Z][A-Za-z0-9]*View$/]',
                    message: 'A view is an `XxxView(bindings)` function, not a `createXxxView` factory. See the style guide, "Views and Bindings".',
                },
                {
                    selector: 'TSInterfaceDeclaration[id.name=/ViewProps$/]',
                    message: 'Name the input of a view `XxxViewBindings`, not props. See the style guide, "Views and Bindings".',
                },
            ],
        },
    },
    {
        // Every import names a dependency of the nearest package.json: npm's
        // flat node_modules would let it resolve anyway, and then break for
        // whoever installs the package.
        files: ['**/*.{ts,tsx,js,mjs,cjs}'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/no-extraneous-dependencies': ['error', {
                devDependencies: DEV_FILES,
                includeTypes: true,
            }],
        },
    },
    // MVT's own rules (packages/tools/eslint-plugin), for models: no wall-clock time
    {
        files: [
            'packages/sites/arcade/src/**/models/**/*.{ts,tsx}', 'packages/sites/arcade/src/**/*-model.ts',
            'packages/sites/playground/src/**/models/**/*.{ts,tsx}', 'packages/sites/playground/src/**/*-model.ts',
            'packages/sites/playground/examples/**/models/**/*.{ts,tsx}', 'packages/sites/playground/examples/**/*-model.ts',
        ],
        ignores: ['**/*.test.{ts,tsx}'],
        ...mvt.configs.architecture,
    },
    // This repo's own style rules (packages/tools/eslint-plugin): no em-dashes, no
    // `null`, no `this`
    {
        files: ['**/*.{ts,tsx,js,mjs,cjs}'],
        ...mvt.configs.style,
    },
    {
        // Methods wrapped onto a library's prototype, and Rollup plugin hooks,
        // can reach their instance or plugin context only through `this`; an
        // audio worklet's processor must be a class, and gets its port that way
        files: [
            'packages/libraries/pixi/src/container-mixin.ts',
            'packages/libraries/three/src/object3d-mixin.ts',
            'packages/sites/arcade/scripts/vite-plugin-spritesheet.ts',
            'packages/libraries/audio/src/web/chip-processor.ts',
            // v-snap replaces canvas text drawing and patches a Pixi pool.
            'packages/tools/v-snap/src/browser/canvas-text.ts',
            'packages/tools/v-snap/src/pixi/pixi-views.ts',
        ],
        rules: { '@mvtjs/no-this': 'off' },
    },
    {
        // .claude/ holds agent worktrees: separate checkouts, linted with their own config.
        // .vitest/ holds Vitest's output, such as an HTML report's scripts, and
        // packages/tools/v-snap/lib/ its build. .wrangler/ holds Wrangler's local
        // state, and worker-configuration.d.ts the Worker types it generates.
        ignores: [
            '**/dist/**', 'node_modules/**', 'packages/sites/docs/.vitepress/**', '.claude/**', '**/.vitest/**', 'packages/tools/v-snap/lib/**',
            '**/.wrangler/**', '**/worker-configuration.d.ts',
        ],
    },
);
