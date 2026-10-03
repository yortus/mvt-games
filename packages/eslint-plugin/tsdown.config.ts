import { defineConfig } from 'tsdown';

// Built to JavaScript before ESLint runs (the root's `prepare` and `prelint`
// scripts), since ESLint loads the plugin through Node, which resolves the
// package's `exports` to `dist/`.
export default defineConfig({
    entry: { index: 'src/index.ts' },
    platform: 'node',
    fixedExtension: false,
    dts: true,
});
