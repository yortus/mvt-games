// Spike: visualTest and friends, in the page.
import { Application, Container, Graphics, RenderTexture, TextureSource } from 'pixi.js';
import { refreshView } from '@mvtjs/pixi';
import type { Camera, Scene, WebGLRenderer as ThreeRenderer, WebGLRenderTarget } from 'three';
import { commands, page } from 'vitest/browser';
import { expect, test } from 'vitest';

// ---------------------------------------------------------------------------
// Config from Node, once per page
// ---------------------------------------------------------------------------

interface SpikeConfig {
    readonly mode: 'compare' | 'update';
    readonly hashes: Record<string, string>;
    readonly flags: { readonly noFontRewrite: boolean; readonly sendAll: boolean; readonly textAsPaths: boolean; readonly freshTarget: boolean; readonly freshStage: boolean; readonly cdpCapture: boolean; readonly colr: boolean; readonly htmlText: 'native' | 'blank' | 'block' | 'blankreal' | 'blanktt' | 'green' };
}

interface SpikeCommands {
    visualRefs: () => Promise<SpikeConfig>;
    visualMismatch: (p: { key: string; hash: string; width: number; height: number; pixels: string }) => Promise<MismatchVerdict>;
    visualDecodePng: (base64: string) => Promise<{ width: number; height: number; hash: string; pixels: string }>;
    visualRecord: (entries: Record<string, unknown>) => Promise<void>;
    visualCapture: (clip: { x: number; y: number; width: number; height: number }) => Promise<{ width: number; height: number; hash: string; pixels: string; captureMs: number; decodeMs: number }>;
}

interface MismatchVerdict {
    readonly verdict: 'updated' | 'new' | 'size' | 'differs';
    readonly detail?: string;
    readonly changed?: number;
    readonly notGreen?: number;
    readonly maxDelta?: number;
    readonly meanDelta?: number;
    readonly total?: number;
}

const cmd = commands as unknown as SpikeCommands;
const g = globalThis as { __visualSpikeConfig?: Promise<SpikeConfig> };

export function spikeConfig(): Promise<SpikeConfig> {
    g.__visualSpikeConfig ??= cmd.visualRefs();
    return g.__visualSpikeConfig;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

const pending: Record<string, unknown> = {};
let pictureCount = 0;

/** Sends this file's hashes and timings to Node; the setup file calls it after each file. */
export async function flushRecords(): Promise<void> {
    const entries = { ...pending };
    for (const key of Object.keys(pending)) delete pending[key];
    if (Object.keys(entries).length > 0) await cmd.visualRecord(entries);
}

export async function recordData(key: string, value: unknown): Promise<void> {
    await cmd.visualRecord({ [key]: value });
}

export async function recordEnvironment(env: Record<string, unknown>): Promise<void> {
    await cmd.visualRecord({ _environment: env });
}

function keyOfCurrentTest(): string {
    const state = expect.getState();
    const path = (state.testPath ?? '').replace(/\\/g, '/');
    const file = path.slice(path.lastIndexOf('/visual-spike/') + '/visual-spike/'.length);
    return `${file} > ${state.currentTestName ?? '?'}`;
}

async function sha(width: number, height: number, pixels: Uint8Array | Uint8ClampedArray): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels as Uint8Array<ArrayBuffer>));
    let hex = '';
    for (let i = 0; i < 16; i++) hex += digest[i].toString(16).padStart(2, '0');
    return `${width}x${height}:${hex}`;
}

function toBase64(bytes: Uint8Array | Uint8ClampedArray): string {
    return (new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) as Uint8Array & { toBase64: () => string }).toBase64();
}

async function judge(key: string, hash: string, width: number, height: number, pixels: () => Uint8Array | Uint8ClampedArray, times: Record<string, number>): Promise<void> {
    const config = await spikeConfig();
    const expected = config.hashes[key];
    const t0 = performance.now();
    let verdict: MismatchVerdict | undefined;
    if (hash !== expected || config.flags.sendAll) {
        verdict = await cmd.visualMismatch({ key, hash, width, height, pixels: toBase64(pixels()) });
        times.slowPath = performance.now() - t0;
    }
    const gc = (globalThis as { gc?: () => void }).gc;
    if (gc !== undefined && pictureCount++ % 100 === 0) gc();
    const heapMb = Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e5) / 10;
    pending[key] = { hash, width, height, heapMb, at: Math.round(performance.now()), ms: roundAll(times), verdict: hash === expected ? 'same' : verdict?.verdict, changed: verdict?.changed, notGreen: verdict?.notGreen, maxDelta: verdict?.maxDelta };
    if (config.mode === 'update' || hash === expected) return;
    if (verdict?.verdict === 'new') throw new Error(`new picture: ${key}`);
    if (verdict?.verdict === 'size') throw new Error(`picture size changed: ${verdict.detail}`);
    throw new Error(`picture differs: ${verdict?.changed} of ${verdict?.total} pixels, max channel delta ${verdict?.maxDelta}, mean ${verdict?.meanDelta?.toFixed(1)}`);
}

function roundAll(times: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of Object.keys(times)) out[k] = Math.round(times[k] * 100) / 100;
    return out;
}

// ---------------------------------------------------------------------------
// Pixi
// ---------------------------------------------------------------------------

export interface PixiPictureOptions {
    readonly width?: number;
    readonly height?: number;
    readonly background?: number;
    readonly pixelArt?: boolean;
    readonly resolution?: number;
    /** Spike only: override MSAA and rounding separately. */
    readonly msaa?: boolean;
    readonly round?: boolean;
}

const MARGIN = 4;
const DEFAULT_BACKGROUND = 0x202024;

let sharedApp: Promise<Application> | undefined;
let resetEachPicture = false;
export function setResetEachPicture(value: boolean): void { resetEachPicture = value; }
const targets = new Map<string, RenderTexture>();
let stage = new Container();
let backdrop = new Graphics();
let holder = new Container();
stage.addChild(backdrop, holder);

// One renderer for every picture. Two WebGL contexts in one page share SwiftShader, and drawing
// with one after the other changes the antialiased edges the other draws next (measured in the spike).
// MSAA is the render texture's (antialias), and rounding is set per picture, so one is enough.
function appFor(pixelArt: boolean): Promise<Application> {
    sharedApp ??= (async () => {
        const a = new Application();
        await a.init({ width: 8, height: 8, antialias: false, autoStart: false, preference: 'webgl', sharedTicker: false });
        return a;
    })();
    return sharedApp.then((a) => {
        (a.renderer as unknown as { _roundPixels: number })._roundPixels = pixelArt ? 1 : 0;
        if (resetEachPicture) a.renderer.resetState();
        return a;
    });
}

function targetFor(width: number, height: number, resolution: number, antialias: boolean): RenderTexture {
    const key = `${width}x${height}@${resolution}${antialias ? 'aa' : ''}`;
    let rt = targets.get(key);
    if (rt === undefined) {
        rt = RenderTexture.create({ width, height, resolution, antialias });
        targets.set(key, rt);
    }
    return rt;
}

export function visualTest(name: string, pose: () => Container | Promise<Container>, options: PixiPictureOptions = {}): void {
    test(name, async () => {
        const key = keyOfCurrentTest();
        const pixelArt = options.pixelArt ?? false;
        const resolution = options.resolution ?? 1;
        const times: Record<string, number> = {};
        let t = performance.now();
        const app = await appFor(options.round ?? pixelArt);
        const { flags } = await spikeConfig();
        if (flags.freshStage) {
            stage.destroy({ children: true });
            stage = new Container();
            backdrop = new Graphics();
            holder = new Container();
            stage.addChild(backdrop, holder);
        }
        TextureSource.defaultOptions.scaleMode = pixelArt ? 'nearest' : 'linear';
        times.app = performance.now() - t;

        t = performance.now();
        const view = await pose();
        times.pose = performance.now() - t;
        try {
            t = performance.now();
            refreshView(view);
            times.refresh = performance.now() - t;

            t = performance.now();
            let x0 = 0;
            let y0 = 0;
            let width = options.width;
            let height = options.height;
            holder.position.set(0, 0);
            holder.addChild(view);
            if (width === undefined || height === undefined) {
                // The holder's bounds, so the view's own position counts
                const b = holder.getLocalBounds();
                x0 = Math.floor(b.minX) - MARGIN;
                y0 = Math.floor(b.minY) - MARGIN;
                width ??= Math.ceil(b.maxX) + MARGIN - x0;
                height ??= Math.ceil(b.maxY) + MARGIN - y0;
            }
            holder.position.set(-x0, -y0);
            backdrop.clear().rect(0, 0, width, height).fill(options.background ?? DEFAULT_BACKGROUND);
            const rt = targetFor(width, height, resolution, options.msaa ?? !pixelArt);
            times.bounds = performance.now() - t;

            t = performance.now();
            app.renderer.render({ container: stage, target: rt, clear: true });
            const { pixels, width: pw, height: ph } = app.renderer.texture.getPixels(rt);
            times.draw = performance.now() - t;

            // A picture of nothing but the background is a pose that drew nothing, or drew it out of frame
            const words = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength >> 2);
            let blank = true;
            for (let i = 1; i < words.length; i++) {
                if (words[i] !== words[0]) { blank = false; break; }
            }
            if (blank) throw new Error('the picture is blank: the view drew nothing inside it');
            t = performance.now();
            const hash = await sha(pw, ph, pixels);
            times.hash = performance.now() - t;
            await judge(key, hash, pw, ph, () => pixels, times);
        }
        finally {
            holder.removeChildren();
            view.destroy({ children: true });
            if (flags.freshTarget) {
                for (const rt of targets.values()) rt.destroy(true);
                targets.clear();
            }
        }
    });
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export interface HtmlPictureOptions {
    readonly width?: number;
    readonly height?: number;
    readonly background?: string;
}

export function visualHtmlTest(name: string, pose: () => HTMLElement | Promise<HTMLElement>, options: HtmlPictureOptions = {}): void {
    test(name, async () => {
        const key = keyOfCurrentTest();
        const times: Record<string, number> = {};
        const host = document.createElement('div');
        host.style.cssText = `position:absolute;left:0;top:0;display:inline-block;background:${options.background ?? '#202024'};`;
        if (options.width !== undefined) host.style.width = `${options.width}px`;
        if (options.height !== undefined) host.style.height = `${options.height}px`;
        let t = performance.now();
        const element = await pose();
        times.pose = performance.now() - t;
        try {
            host.append(element);
            document.body.append(host);
            await document.fonts.ready;
            // Every image loaded and decoded, lazy ones included
            await Promise.all([...host.querySelectorAll('img')].map((img) => {
                img.loading = 'eager';
                return img.decode().catch(() => undefined);
            }));
            let decoded: { width: number; height: number; hash: string; pixels: string };
            if ((await spikeConfig()).flags.cdpCapture) {
                const box = host.getBoundingClientRect();
                const frame = (window.frameElement ?? undefined)?.getBoundingClientRect();
                t = performance.now();
                // Rounded outwards, as Playwright's element screenshots are
                const left = Math.floor(box.left + (frame?.left ?? 0));
                const top = Math.floor(box.top + (frame?.top ?? 0));
                const captured = await cmd.visualCapture({ x: left, y: top, width: Math.ceil(box.right + (frame?.left ?? 0)) - left, height: Math.ceil(box.bottom + (frame?.top ?? 0)) - top });
                times.screenshot = performance.now() - t;
                times.cdpCapture = captured.captureMs;
                times.decode = captured.decodeMs;
                decoded = captured;
            }
            else {
                t = performance.now();
                const base64 = await page.screenshot({ element: host, save: false });
                times.screenshot = performance.now() - t;
                t = performance.now();
                decoded = await cmd.visualDecodePng(base64);
                times.decode = performance.now() - t;
            }
            const bytes = Uint8Array.from(atob(decoded.pixels), (c) => c.charCodeAt(0));
            await judge(key, decoded.hash, decoded.width, decoded.height, () => bytes, times);
        }
        finally {
            host.remove();
        }
    });
}

// ---------------------------------------------------------------------------
// three.js
// ---------------------------------------------------------------------------

export interface ThreePictureOptions {
    readonly width: number;
    readonly height: number;
}

let three: Promise<{ renderer: ThreeRenderer; target: (w: number, h: number) => WebGLRenderTarget }> | undefined;

export function visualThreeTest(name: string, pose: () => { scene: Scene; camera: Camera } | Promise<{ scene: Scene; camera: Camera }>, options: ThreePictureOptions): void {
    test(name, async () => {
        const key = keyOfCurrentTest();
        const times: Record<string, number> = {};
        three ??= (async () => {
            const T = await import('three');
            const renderer = new T.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(1);
            const pool = new Map<string, WebGLRenderTarget>();
            return {
                renderer,
                target: (w: number, h: number) => {
                    let rt = pool.get(`${w}x${h}`);
                    if (rt === undefined) {
                        rt = new T.WebGLRenderTarget(w, h, { samples: 4, colorSpace: T.SRGBColorSpace });
                        pool.set(`${w}x${h}`, rt);
                    }
                    return rt;
                },
            };
        })();
        const { renderer, target } = await three;
        let t = performance.now();
        const { scene, camera } = await pose();
        times.pose = performance.now() - t;
        t = performance.now();
        const rt = target(options.width, options.height);
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(options.width * options.height * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, options.width, options.height, pixels);
        renderer.setRenderTarget(null);
        // WebGL reads bottom row first
        const row = options.width * 4;
        const swap = new Uint8Array(row);
        for (let top = 0, bottom = options.height - 1; top < bottom; top++, bottom--) {
            swap.set(pixels.subarray(top * row, top * row + row));
            pixels.copyWithin(top * row, bottom * row, bottom * row + row);
            pixels.set(swap, bottom * row);
        }
        times.draw = performance.now() - t;
        t = performance.now();
        const hash = await sha(options.width, options.height, pixels);
        times.hash = performance.now() - t;
        await judge(key, hash, options.width, options.height, () => pixels, times);
    });
}
