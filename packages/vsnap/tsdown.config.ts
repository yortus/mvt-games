import { defineConfig } from 'tsdown';

// The published build, in `lib`: one output file per source module
// (`unbundle`), so the Node side can find the setup file and the browser
// install step beside it. The folder is not `dist`, because Vite leaves
// files under `dist` out of `optimizeDeps.entries`, and the setup file is one
// of those entries.
export default defineConfig({
    entry: {
        'browser/index': 'src/browser/index.ts',
        'browser/setup': 'src/browser/setup.ts',
        'browser/no-config': 'src/browser/no-config.ts',
        'node/index': 'src/node/index.ts',
        'node/install-browser': 'src/node/install-browser.ts',
        'pixi/index': 'src/pixi/index.ts',
        'three/index': 'src/three/index.ts',
    },
    outDir: 'lib',
    unbundle: true,
    platform: 'node',
    fixedExtension: false,
    // The fonts' URLs are Vite's to make, and the project's config is Vite's
    // to find, when the tests run.
    deps: { neverBundle: [/\?url$/, 'virtual:vsnap-config'] },
    copy: [{ from: 'src/browser/fonts/*.{ttf,otf}', to: 'lib/browser/fonts' }],
    dts: true,
    publint: true,
    attw: { profile: 'esm-only' },
});
