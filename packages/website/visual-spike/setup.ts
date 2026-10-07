// Spike: the setup file. Runs before every test file; one-time work is guarded,
// since with isolation off every file shares this page.
import { BatchableGraphics } from 'pixi.js';
import { afterAll, beforeEach } from 'vitest';
import { flushRecords, recordEnvironment, spikeConfig } from './harness';
import { installTextPaths } from './text-paths';
import { installHtmlText } from './html-text';
import sansUrl from './fonts/SourceSans3VF-Upright.otf?url';
import monoUrl from './fonts/SourceCodeVF-Upright.otf?url';
import sansColrUrl from './fonts/SourceSans3VF-Colr.otf?url';
import monoColrUrl from './fonts/SourceCodeVF-Colr.otf?url';

export const TEST_SANS = 'VT Sans';
export const TEST_MONO = 'VT Mono';

/** Named families the views ask for, drawn in a test font instead. */
const SHADOWED_SANS = ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Arial', 'Roboto', 'Inter', 'Georgia', 'Noto Sans', 'Ubuntu', 'Cantarell'];
const SHADOWED_MONO = ['Consolas', 'Menlo', 'Monaco', 'Courier New', 'SF Mono', 'Cascadia Code', 'Cascadia Mono', 'Liberation Mono', 'DejaVu Sans Mono', 'Roboto Mono'];

const GENERIC_MONO = /(^|[\s,])(["']?)(ui-monospace|monospace)\2(?=$|[\s,])/g;
const GENERIC_SANS = /(^|[\s,])(["']?)(system-ui|-apple-system|BlinkMacSystemFont|ui-sans-serif|sans-serif|ui-serif|serif)\2(?=$|[\s,])/g;

export function rewriteFont(font: string): string {
    return font.replace(GENERIC_MONO, `$1"${TEST_MONO}"`).replace(GENERIC_SANS, `$1"${TEST_SANS}"`);
}

interface SpikeGlobal { __visualSpikeReady?: Promise<void> }
const g = globalThis as SpikeGlobal;

g.__visualSpikeReady ??= (async () => {
    // Pixi 8.21 bug: BatchableGraphics.reset() leaves roundPixels as it was, so a pooled batch
    // from a rounded (pixel-art) graphic rounds the next graphics context built from the pool
    const reset = BatchableGraphics.prototype.reset;
    BatchableGraphics.prototype.reset = function (this: BatchableGraphics) {
        reset.call(this);
        this.roundPixels = 0;
    };
    const { flags } = await spikeConfig();
    const sansFace = flags.colr ? sansColrUrl : sansUrl;
    const monoFace = flags.colr ? monoColrUrl : monoUrl;
    const faces: FontFace[] = [];
    for (const family of [TEST_SANS, ...SHADOWED_SANS]) faces.push(new FontFace(family, `url(${sansFace})`, { weight: '200 900' }));
    for (const family of [TEST_MONO, ...SHADOWED_MONO]) faces.push(new FontFace(family, `url(${monoFace})`, { weight: '200 900' }));
    await Promise.all(faces.map(async (face) => {
        await face.load();
        document.fonts.add(face);
    }));
    // Blank or block text: every family, in CSS and on canvases, becomes one test font
    const onlyFamily = await installHtmlText(flags.htmlText, flags.wholeControlSize);
    if (!flags.noFontRewrite) {
        for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype]) {
            const font = Object.getOwnPropertyDescriptor(proto, 'font')!;
            Object.defineProperty(proto, 'font', {
                configurable: true,
                get: font.get,
                set(this: CanvasRenderingContext2D, value: string) { font.set!.call(this, onlyFamily === undefined ? rewriteFont(value) : value.replace(/(\d(?:\.\d+)?px(?:\/\S+)?)\s+.*$/, `$1 ${onlyFamily}`)); },
            });
        }
    }
    if (flags.textAsPaths) await installTextPaths({ sansUrl, monoUrl, sansFamilies: [TEST_SANS, ...SHADOWED_SANS], monoFamilies: [TEST_MONO, ...SHADOWED_MONO] });
    document.body.style.margin = '0';
    // The environment, recorded once per run beside the pictures
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    await recordEnvironment({
        userAgent: navigator.userAgent,
        platform: (navigator as unknown as { userAgentData?: { platform: string } }).userAgentData?.platform,
        cores: navigator.hardwareConcurrency,
        webglRenderer: info ? gl?.getParameter(info.UNMASKED_RENDERER_WEBGL) : undefined,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        devicePixelRatio,
        textAsPaths: flags.textAsPaths,
        colr: flags.colr,
        htmlText: flags.htmlText,
    });
})();

await g.__visualSpikeReady;

// Seeded Math.random, reset before every test (mulberry32)
let seed = 0;
Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
beforeEach(() => {
    seed = 0x5eed;
});
afterAll(flushRecords);
