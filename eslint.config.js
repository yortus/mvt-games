import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

// Views are `XxxView(bindings)` functions, query bindings have no `get` prefix,
// and types use function-valued properties.
const VIEW_CONVENTION_FILES = [
    'src/**/*.{ts,tsx}',
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
        files: ['src/**/*.{ts,tsx}'],
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
                        // Allow external packages
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
                        // Allow project-level import-map aliases. Escaped: the
                        // rule compiles each entry with minimatch, which reads a
                        // leading `#` as a comment, and then crashes on the first
                        // violation instead of reporting it (proposal 011 section 11.1)
                        '\\#common',
                        '\\#mvt-utils',
                        '\\#pixi-mvt/jsx',
                        '\\#three-mvt/jsx',
                        '\\#html-mvt/jsx',
                        // Allow a package-shaped directory's public `jsx` subpath,
                        // which each would export as `./jsx` once it is a package
                        '**/mvt-utils/jsx',
                        // The JSX conformance suite, for each JSX target's tests
                        '**/mvt-utils/jsx/conformance',
                        '**/pixi-mvt/jsx',
                        '**/three-mvt/jsx',
                        '**/html-mvt/jsx',
                    ],
                },
            ],
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
            },
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
        // .claude/ holds agent worktrees: separate checkouts, linted with their own config.
        ignores: ['dist/**', 'node_modules/**', 'docs/.vitepress/**', '.claude/**'],
    },
);
