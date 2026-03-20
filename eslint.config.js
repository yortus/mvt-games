import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

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
        files: ['**/*.{ts,js,mjs,cjs}'],
        plugins: {
            '@stylistic': stylistic,
            'import': importPlugin,
        },
        rules: {
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/no-multi-spaces': 'off',
            '@stylistic/operator-linebreak': ['error', 'after', {
                overrides: {
                    '&': 'before',
                    '|': 'before',
                },
            }],
            '@stylistic/quote-props': ['error', 'consistent'],
            // Allow underscore-prefixed unused parameters
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['src/**/*.ts'],
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
                        // Allow project-level import-map aliases
                        '#common',
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
        ignores: ['dist/**', 'node_modules/**'],
    },
);
