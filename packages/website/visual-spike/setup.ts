// Spike: the setup file. Runs before every test file; one-time work is guarded,
// since with isolation off every file shares this page.
import { afterAll, beforeEach } from 'vitest';
import { flushRecords, spikeConfig } from './harness';
import sansUrl from './fonts/SourceSans3VF-Upright.otf?url';
import monoUrl from './fonts/SourceCodeVF-Upright.otf?url';

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
    const faces: FontFace[] = [];
    for (const family of [TEST_SANS, ...SHADOWED_SANS]) faces.push(new FontFace(family, `url(${sansUrl})`, { weight: '200 900' }));
    for (const family of [TEST_MONO, ...SHADOWED_MONO]) faces.push(new FontFace(family, `url(${monoUrl})`, { weight: '200 900' }));
    await Promise.all(faces.map(async (face) => {
        await face.load();
        document.fonts.add(face);
    }));
    const { flags } = await spikeConfig();
    if (!flags.noFontRewrite) {
        for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype]) {
            const font = Object.getOwnPropertyDescriptor(proto, 'font')!;
            Object.defineProperty(proto, 'font', {
                configurable: true,
                get: font.get,
                set(this: CanvasRenderingContext2D, value: string) { font.set!.call(this, rewriteFont(value)); },
            });
        }
    }
    document.body.style.margin = '0';
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
