import { defineConfig } from 'tsdown';

// The published build: one entry per path in package.json's `exports`, and
// one output file per source module (`unbundle`), so the modules with side
// effects at load keep the names `sideEffects` lists.
export default defineConfig({
    entry: {
        'index': 'src/index.ts',
        'jsx/index': 'src/jsx/index.ts',
        'jsx/jsx-runtime': 'src/jsx/jsx-runtime.ts',
        'jsx/jsx-dev-runtime': 'src/jsx/jsx-dev-runtime.ts',
    },
    unbundle: true,
    platform: 'neutral',
    dts: true,
    publint: true,
    attw: true,
});
