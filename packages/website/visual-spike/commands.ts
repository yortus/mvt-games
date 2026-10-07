// Spike: the Node side of the visual test harness, as Vitest browser commands.
//
// References live in visual-spike/__refs__/: one PNG per picture, and one
// hashes.json for the whole set (the real design keeps the hash in a PNG text
// chunk; the spike does not need to prove that).
//
// SPIKE_MODE:
//   compare (default): a mismatch writes actual + diff to .vitest/visual/ and fails
//   update: a mismatch or new picture writes the reference
// SPIKE_LABEL names this run's results file, visual-spike/results/<label>.json,
// holding every picture's hash and timings.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { BrowserCommand } from 'vitest/node';

const SPIKE = import.meta.dirname;
const REFS = join(SPIKE, process.env.SPIKE_REFS ?? '__refs__');
const HASHES = join(REFS, 'hashes.json');
const OUT = resolve(SPIKE, '..', '..', '..', '.vitest', 'visual');
const RESULTS = join(SPIKE, 'results');

const mode = process.env.SPIKE_MODE ?? 'compare';
const label = process.env.SPIKE_LABEL ?? 'local';

let hashes: Record<string, string> | undefined;
const results: Record<string, unknown> = {};
let resultsDirty = false;

function loadHashes(): Record<string, string> {
    hashes ??= existsSync(HASHES) ? JSON.parse(readFileSync(HASHES, 'utf8')) as Record<string, string> : {};
    return hashes;
}

function fileFor(key: string): string {
    return key.replace(/[^\w.-]+/g, '_') + '.png';
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
    const png = new PNG({ width, height, colorType: 6, inputHasAlpha: true });
    png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    return PNG.sync.write(png, { deflateLevel: 9, filterType: 4 });
}

export function hashPixels(width: number, height: number, rgba: Uint8Array): string {
    return `${width}x${height}:` + createHash('sha256').update(rgba).digest('hex').slice(0, 32);
}

const visualRefs: BrowserCommand<[]> = () => ({
    mode,
    hashes: loadHashes(),
    flags: {
        noFontRewrite: process.env.SPIKE_NO_FONT_REWRITE === '1',
        /** Send every picture's pixels to Node (to time the slow path, or to collect every PNG). */
        sendAll: process.env.SPIKE_SEND_ALL === '1',
        textAsPaths: process.env.SPIKE_TEXT_AS_PATHS === '1',
        cdpCapture: process.env.SPIKE_CDP !== '0',
        colr: process.env.SPIKE_COLR === '1',
        htmlText: process.env.SPIKE_HTML_TEXT ?? 'native',
        wholeControlSize: process.env.SPIKE_CONTROL_SIZE === '1',
        pixelateRotated: process.env.SPIKE_PIXELATE_ROTATED === '1',
        fieldWidth: process.env.SPIKE_FIELD_WIDTH === '1',
        freshTarget: process.env.SPIKE_FRESH_TARGET === '1',
        freshStage: process.env.SPIKE_FRESH_STAGE === '1',
    },
});

interface MismatchPayload {
    readonly key: string;
    readonly hash: string;
    readonly width: number;
    readonly height: number;
    readonly pixels: string; // base64 RGBA
}

const visualMismatch: BrowserCommand<[MismatchPayload]> = (_ctx, p) => {
    const rgba = new Uint8Array(Buffer.from(p.pixels, 'base64'));
    const all = loadHashes();
    const refFile = join(REFS, fileFor(p.key));
    if (mode === 'update') {
        mkdirSync(REFS, { recursive: true });
        writeFileSync(refFile, encodePng(p.width, p.height, rgba));
        all[p.key] = p.hash;
        writeFileSync(HASHES, JSON.stringify(sortKeys(all), null, 1) + '\n');
        return { verdict: 'updated' };
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, fileFor(p.key).replace(/\.png$/, '.actual.png')), encodePng(p.width, p.height, rgba));
    if (!existsSync(refFile)) return { verdict: 'new' };
    const ref = PNG.sync.read(readFileSync(refFile));
    if (ref.width !== p.width || ref.height !== p.height) {
        return { verdict: 'size', detail: `${ref.width}x${ref.height} -> ${p.width}x${p.height}` };
    }
    // Count pixels that differ, and how much (the largest channel difference)
    const diff = new PNG({ width: p.width, height: p.height });
    let changed = 0;
    let maxDelta = 0;
    let sumDelta = 0;
    // Differing pixels where neither picture leans green: what a differ that ignores green text would see
    let notGreen = 0;
    for (let i = 0; i < rgba.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(rgba[i + c] - ref.data[i + c]));
        const g = (ref.data[i] + ref.data[i + 1] + ref.data[i + 2]) / 3;
        if (d > 0 && !isGreenish(rgba, i) && !isGreenish(ref.data, i)) notGreen++;
        if (d > 0) {
            changed++;
            sumDelta += d;
            maxDelta = Math.max(maxDelta, d);
            diff.data[i] = 255; diff.data[i + 1] = 0; diff.data[i + 2] = 0; diff.data[i + 3] = 255;
        }
        else {
            diff.data[i] = diff.data[i + 1] = diff.data[i + 2] = g * 0.3; diff.data[i + 3] = 255;
        }
    }
    writeFileSync(join(OUT, fileFor(p.key).replace(/\.png$/, '.diff.png')), PNG.sync.write(diff));
    return { verdict: 'differs', changed, notGreen, maxDelta, meanDelta: changed ? sumDelta / changed : 0, total: p.width * p.height };
};

function isGreenish(data: Uint8Array | Buffer, i: number): boolean {
    return data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30;
}

/** For HTML pictures: a screenshot's PNG, decoded and hashed by its pixels. */
const visualDecodePng: BrowserCommand<[string]> = (_ctx, base64) => {
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
    return { width: png.width, height: png.height, hash: hashPixels(png.width, png.height, rgba), pixels: Buffer.from(rgba).toString('base64') };
};

interface CdpLike { send: (method: string, params?: Record<string, unknown>) => Promise<{ data: string }> }
const cdpSessions = new Map<string, Promise<CdpLike>>();

/** For HTML pictures, the fast way: Chrome's own screenshot of a rectangle, through the DevTools protocol. */
const visualCapture: BrowserCommand<[{ x: number; y: number; width: number; height: number }]> = async (ctx, clip) => {
    let cdp = cdpSessions.get(ctx.sessionId);
    if (cdp === undefined) {
        cdp = (ctx.provider as unknown as { getCDPSession: (id: string) => Promise<CdpLike> }).getCDPSession(ctx.sessionId);
        cdpSessions.set(ctx.sessionId, cdp);
    }
    const t0 = performance.now();
    const { data } = await (await cdp).send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, optimizeForSpeed: true, captureBeyondViewport: false });
    const t1 = performance.now();
    const png = PNG.sync.read(Buffer.from(data, 'base64'));
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
    const hash = hashPixels(png.width, png.height, rgba);
    return { width: png.width, height: png.height, hash, pixels: Buffer.from(rgba).toString('base64'), captureMs: t1 - t0, decodeMs: performance.now() - t1 };
};

/** Every picture's hash and timings, sent once per file. */
const visualRecord: BrowserCommand<[Record<string, unknown>]> = (_ctx, entries) => {
    Object.assign(results, entries);
    resultsDirty = true;
    flushResults();
};

function flushResults(): void {
    if (!resultsDirty) return;
    mkdirSync(RESULTS, { recursive: true });
    const file = join(RESULTS, `${label}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(sortKeys(results), null, 1) + '\n');
    resultsDirty = false;
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export const spikeCommands = { visualRefs, visualMismatch, visualDecodePng, visualRecord, visualCapture };
