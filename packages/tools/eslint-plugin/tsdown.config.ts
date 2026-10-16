import { defineConfig } from 'tsdown';

// Built to JavaScript for publishing. The repo's own ESLint config imports the
// source instead, so linting needs no build.
export default defineConfig({
    entry: { index: 'src/index.ts' },
    platform: 'node',
    fixedExtension: false,
    dts: true,
});
