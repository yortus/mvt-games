import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        plugins: {
            import: importPlugin,
        },
        rules: {
            // Allow underscore-prefixed unused parameters
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
