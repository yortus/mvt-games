import { defineConfig } from 'tsdown';

// This config builds the package for publishing. It makes one entry for
// each path in package.json's `exports`, and one output file for each source
// module (`unbundle`). So the modules with side effects at load keep the file
// names that `sideEffects` lists.
export default defineConfig({
    entry: {
        'index': 'src/index.ts',
        'jsx/jsx-runtime': 'src/jsx/jsx-runtime.ts',
        'jsx/jsx-dev-runtime': 'src/jsx/jsx-dev-runtime.ts',
    },
    unbundle: true,
    platform: 'neutral',
    dts: true,
    publint: true,
    attw: true,
});
