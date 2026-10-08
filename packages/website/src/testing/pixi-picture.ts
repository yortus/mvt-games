import { Application, Container, Graphics, RenderTexture, TextureSource } from 'pixi.js';
import { fitPicture } from './picture-budget';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PixiPictureOptions {
    /** The picture's size in the view's pixels. Default: the view's bounds after its first refresh, plus a margin. */
    readonly width?: number;
    readonly height?: number;
    /** Default: one opaque dark grey, the same for every test, so transparent areas show. */
    readonly background?: number;
    /**
     * Whether the view is smooth: drawn with antialiased edges, at
     * fractional positions, its own textures sampled smoothly. Default
     * false: drawn as pixel art is, hard-edged, on whole pixels, textures
     * nearest-neighbour. A smooth picture larger than the size budget is
     * drawn at a lower resolution to fit it (half, a quarter, ...), every
     * detail finer than a picture pixel averaged away; a pixel-art one
     * cannot be, and fails instead.
     */
    readonly isSmooth?: boolean;
}

/** A picture's pixels, read back from the renderer: RGBA, rows from the top, opaque. */
export interface PixiPicture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
    /** Picture pixels per view pixel: 1, or less for a big smooth view. */
    readonly resolution: number;
    /** Whether every pixel is the background's: the view drew nothing inside the picture. */
    readonly isBlank: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Sets the texture defaults a pose's textures are made with, before the
 * pose runs: entries set them per entry, and a test must not inherit the
 * last one's. (The games' spritesheets set their own, nearest-neighbour.)
 */
export function preparePixiPose(options: PixiPictureOptions): void {
    TextureSource.defaultOptions.scaleMode = options.isSmooth === true ? 'linear' : 'nearest';
}

/**
 * Draws a refreshed view into a render texture and reads its pixels back.
 * No screenshot: the renderer's own pixels, with no compositor or colour
 * management in between. Throws if the picture is over the size budget
 * and cannot be drawn smaller.
 */
export async function drawPixiPicture(view: Container, options: PixiPictureOptions & { readonly maxPixels: number }): Promise<PixiPicture> {
    const isSmooth = options.isSmooth === true;
    const app = await appFor(isSmooth);
    holder.position.set(0, 0);
    holder.addChild(view);
    try {
        let x0 = 0;
        let y0 = 0;
        let width = options.width;
        let height = options.height;
        if (width === undefined || height === undefined) {
            // The holder's bounds, so the view's own position counts (a view's local bounds leave it out)
            const bounds = holder.getLocalBounds();
            x0 = Math.floor(bounds.minX) - MARGIN;
            y0 = Math.floor(bounds.minY) - MARGIN;
            width ??= Math.ceil(bounds.maxX) + MARGIN - x0;
            height ??= Math.ceil(bounds.maxY) + MARGIN - y0;
        }
        const fit = fitPicture({ width, height, maxPixels: options.maxPixels, canScale: isSmooth });
        if ('problem' in fit) throw new Error(fit.problem);
        holder.position.set(-x0, -y0);
        backdrop.clear().rect(0, 0, width, height).fill(options.background ?? DEFAULT_BACKGROUND);
        const target = targetFor(width, height, fit.resolution, isSmooth);
        app.renderer.render({ container: stage, target, clear: true });
        const read = app.renderer.texture.getPixels(target);
        const pixels = new Uint8Array(read.pixels.buffer, read.pixels.byteOffset, read.pixels.byteLength);
        return { width: read.width, height: read.height, pixels, resolution: fit.resolution, isBlank: isAllOne(pixels) };
    }
    finally {
        holder.removeChildren();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Room round a view's bounds, so an antialiased edge or a glow at them is in the picture. */
const MARGIN = 4;
const DEFAULT_BACKGROUND = 0x202024;

/** What every picture is drawn from: a backdrop, then the view, moved by its bounds. */
const stage = new Container();
const backdrop = new Graphics();
const holder = new Container();
stage.addChild(backdrop, holder);

let app: Promise<Application> | undefined;
const targets = new Map<string, RenderTexture>();

/**
 * One renderer for every picture, made on first use and kept: MSAA is the
 * render texture's, and whole-pixel positions are set per picture. Its
 * context's own antialiasing is fixed (off): it changes MSAA edges in render
 * textures too, so it must never be left to a default.
 */
async function appFor(isSmooth: boolean): Promise<Application> {
    app ??= (async () => {
        const made = new Application();
        await made.init({ width: 8, height: 8, antialias: false, autoStart: false, preference: 'webgl', sharedTicker: false });
        return made;
    })();
    const ready = await app;
    // The renderer reads this field every frame; Pixi offers no setter
    (ready.renderer as unknown as { _roundPixels: number })._roundPixels = isSmooth ? 0 : 1;
    return ready;
}

/** A render texture of each size, kept, so the canvas is never resized and no texture is made per test. */
function targetFor(width: number, height: number, resolution: number, isAntialiased: boolean): RenderTexture {
    const key = `${width}x${height}@${resolution}${isAntialiased ? 'aa' : ''}`;
    let target = targets.get(key);
    if (target === undefined) {
        target = RenderTexture.create({ width, height, resolution, antialias: isAntialiased });
        targets.set(key, target);
    }
    return target;
}

function isAllOne(pixels: Uint8Array): boolean {
    const words = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength >> 2);
    for (let i = 1; i < words.length; i++) {
        if (words[i] !== words[0]) return false;
    }
    return true;
}
