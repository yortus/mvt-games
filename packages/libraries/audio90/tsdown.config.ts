import { dirname, resolve } from 'node:path';
import { build, type Plugin } from 'rolldown';
import { defineConfig } from 'tsdown';

// The published build: one entry per path in package.json's `exports`, and
// one output file per source module (`unbundle`). publint and attw check the
// package after its published package.json is in place
// (scripts/publish-manifest.ts), since the repository's names the source.
export default defineConfig({
    entry: {
        'index': 'src/index.ts',
        'headless/index': 'src/headless/index.ts',
    },
    unbundle: true,
    platform: 'neutral',
    dts: true,
    plugins: [inlineWorklets()],
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Each browser chip imports its worklet module's URL with Vite's
 * `?worker&url`, which only Vite understands. In the published build, each
 * such import becomes the worklet's code, bundled into one module and
 * minified, served from a Blob URL. So the package works with any bundler,
 * or none, with no file to copy beside the app.
 */
function inlineWorklets(): Plugin {
    const viteSuffix = '?worker&url';
    // The worklet keeps its own path, so its module is output beside the chip's
    const suffix = '?inline-worklet';
    return {
        name: 'inline-worklets',
        resolveId(source, importer) {
            if (!source.endsWith(viteSuffix) || importer === undefined) return undefined;
            return `${resolve(dirname(importer), `${source.slice(0, -viteSuffix.length)}.ts`)}${suffix}`;
        },
        async load(id) {
            if (!id.endsWith(suffix)) return undefined;
            const { output } = await build({
                input: id.slice(0, -suffix.length),
                platform: 'browser',
                write: false,
                output: { format: 'esm', minify: true },
            });
            const code = JSON.stringify(output[0].code);
            return `export default URL.createObjectURL(new Blob([${code}], { type: 'text/javascript' }));\n`;
        },
    };
}
