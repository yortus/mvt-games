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

// The playground's examples and starting projects: small projects, written as
// an entry's code is, and linted by the same rules.
const PLAYGROUND_EXAMPLES = 'packages/sites/playground/{examples,starters}/**/*.{ts,tsx}';

// Views are `XxxView(bindings)` functions, query bindings have no `get` prefix,
// and types use function-valued properties.
const VIEW_CONVENTION_FILES = [
    'packages/*/*/src/**/*.{ts,tsx}',
    PLAYGROUND_EXAMPLES,
];

// What a view's files must not declare, as `no-restricted-syntax` selectors.
// Each block that sets `no-restricted-syntax` for these files repeats them,
// since a later block's setting replaces an earlier one's.
const VIEW_CONVENTION_SELECTORS = [
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
];

const POW_MESSAGE = 'Write `Math.exp(y * Math.log(x))`, or `Math.exp(n * LN_SEMITONE)` for notes `n` semitones apart. `Math.pow` and `**` round differently on different systems, so a sound would hash differently on each. See `LN_SEMITONE` in shared/notes.ts.';

// No module imports its own barrel or an ancestor's (`.`, `..`, `../..`,
// `./index` and the like): inside a directory, import the file directly
// (packages/sites/docs/reference/project-structure.md).
const OWN_BARREL_IMPORT = {
    regex: '^\\.{1,2}(/\\.\\.)*(/index)?/?$',
    message: 'Import the file directly, not your own or an ancestor\'s barrel (packages/sites/docs/reference/project-structure.md).',
};

// The view tick API, and `advanceTime`, which a renderer package re-exports
// from @mvtjs/utils. Code that uses a renderer imports these from it: one
// place to import each from, an import that also loads the renderer, which
// registers its views with `updateView` and declares their type in `View`,
// and the same copy of @mvtjs/utils that the renderer was built against.
const VIEW_TICK_API_FROM_RENDERER = {
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
        // Every file in a package, wherever it is: a file outside a package's
        // src/ imports its modules by the package's name, or through an
        // `imports` mapping (`#highscores`), never by a relative path.
        files: ['packages/**/*.{ts,tsx,js,mjs,cjs}'],
        plugins: {
            '@mvtjs': mvt,
        },
        rules: {
            '@mvtjs/no-relative-imports-into-src': 'error',
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
            'no-restricted-imports': ['error', { patterns: [OWN_BARREL_IMPORT], paths: [VIEW_TICK_API_FROM_RENDERER] }],
        },
    },
    {
        files: ['packages/tests/benchmarks/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', { paths: [VIEW_TICK_API_FROM_RENDERER] }],
        },
    },
    {
        files: VIEW_CONVENTION_FILES,
        rules: {
            'no-restricted-syntax': ['error', ...VIEW_CONVENTION_SELECTORS],
        },
    },
    {
        // The sound chips render the same samples on every system, so a test
        // that hashes them passes everywhere. Node and Chrome compute
        // `Math.pow` and `**` with the system's C library, whose last digit
        // differs between Linux and Windows. `Math.exp` and `Math.log` are V8's own.
        // A test may use `Math.pow` for a value it checks within a tolerance.
        files: ['packages/libraries/chiptune/src/**/*.ts'],
        ignores: ['**/*.test.ts'],
        rules: {
            'no-restricted-properties': ['error', { object: 'Math', property: 'pow', message: POW_MESSAGE }],
            'no-restricted-syntax': [
                'error',
                ...VIEW_CONVENTION_SELECTORS,
                { selector: 'BinaryExpression[operator="**"]', message: POW_MESSAGE },
                { selector: 'AssignmentExpression[operator="**="]', message: POW_MESSAGE },
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
            'packages/sites/playground/{examples,starters}/**/models/**/*.{ts,tsx}', 'packages/sites/playground/{examples,starters}/**/*-model.ts',
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
            'packages/sites/arcade/scripts/vite-plugin-entry-pages.ts',
            'packages/sites/arcade/scripts/vite-plugin-spritesheet.ts',
            'packages/sites/playground/scripts/vite-plugin-library-types.ts',
            'packages/libraries/chiptune/src/web/register-chip-processor.ts',
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
