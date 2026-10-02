import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

// Views are `XxxView(bindings)` functions, query bindings have no `get` prefix,
// and types use function-valued properties.
const VIEW_CONVENTION_FILES = [
    'src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
];

// No module imports its own barrel or an ancestor's (`.`, `..`, `../..`,
// `./index` and the like): inside a directory, import the file directly
// (docs/reference/project-structure.md).
const OWN_BARREL_IMPORT = {
    regex: '^\\.{1,2}(/\\.\\.)*(/index)?/?$',
    message: 'Import the file directly, not your own or an ancestor\'s barrel (docs/reference/project-structure.md).',
};

// The tick API a renderer package re-exports from @mvtjs/utils. Code that uses
// a renderer imports these from it: one place to import each from, and the
// same copy of the counters that the renderer counts into.
const TICK_API_FROM_RENDERER = {
    name: '@mvtjs/utils',
    importNames: [
        'SKIP_DESCENDANTS', 'hasUpdate', 'hasRefresh',
        'addReads', 'countReads', 'readCounter', 'countScene', 'sceneCounter',
        'UpdateMethod', 'RefreshMethod', 'SceneCounts',
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
    'benchmarks/**',
    'docs/**',
    '*.config.{ts,js}',
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
        files: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            // Enforce barrel imports: disallow reaching past a directory's index.ts
            'import/no-internal-modules': [
                'error',
                {
                    allow: [
                        // Allow intra-directory relative imports (./foo)
                        './*',
                        // Allow external packages. The @mvtjs packages' own
                        // `exports` say what can be reached in them
                        '@mvtjs/**',
                        'pixi.js',
                        'pixi.js/**',
                        'gsap',
                        'gsap/**',
                        'codemirror',
                        '@codemirror/**',
                        'sucrase',
                        'lz-string',
                        'solid-js',
                        'solid-js/**',
                        'pixi-solid',
                        'three',
                        'three/**',
                        // Allow the site's import-map alias. Escaped: the rule
                        // compiles each entry with minimatch, which reads a
                        // leading `#` as a comment, and then crashes on the first
                        // violation instead of reporting it.
                        '\\#common',
                    ],
                },
            ],
            'no-restricted-imports': ['error', { patterns: [OWN_BARREL_IMPORT] }],
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: ['./src/tsconfig.json', './packages/*/tsconfig.json'],
                    noWarnOnMultipleProjects: true,
                },
            },
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', { patterns: [OWN_BARREL_IMPORT], paths: [TICK_API_FROM_RENDERER] }],
        },
    },
    {
        files: ['benchmarks/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', { paths: [TICK_API_FROM_RENDERER] }],
        },
    },
    {
        files: VIEW_CONVENTION_FILES,
        // The playground builds DOM and CodeMirror views, and its presets follow
        // the sandbox's own `createView(model)` contract.
        ignores: ['src/playground/**'],
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
    {
        // .claude/ holds agent worktrees: separate checkouts, linted with their own config.
        ignores: ['dist/**', 'node_modules/**', 'docs/.vitepress/**', '.claude/**'],
    },
);
