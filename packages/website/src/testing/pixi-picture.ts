import { Application, Container, Graphics, RenderTexture, TextureSource } from 'pixi.js';
import { fitPicture } from './picture-budget';
import { isAllOne } from './picture-pixels';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PixiPictureOptions {
    /**
     * The picture's size in the view's pixels. By default, it is the view's
     * bounds after its first refresh, plus a margin.
     */
    readonly width?: number;
    readonly height?: number;
    /**
     * The colour behind the view. By default, it is one opaque dark grey,
     * the same for every test, so that transparent areas show.
     */
    readonly background?: number;
    /**
     * How the view's art is drawn. Set it to the style that the view's game
     * draws it in. The default is `'pixel'`.
     *
     * - `'pixel'` is for pixel art. Edges are hard (no antialiasing), and
     *   positions are rounded to whole pixels. The textures that the pose
     *   makes are sampled nearest-neighbour, so a magnified image stays
     *   blocky. The picture is always drawn at full size. A picture over
     *   the size budget (`maxPixels` in `vitest.visual.config.ts`) fails,
     *   since drawing pixel art smaller would drop whole texels (texture
     *   pixels). Crop it (`width`, `height`) or pose part of the view
     *   instead.
     * - `'smooth'` gives antialiased edges and fractional positions, and the
     *   pose's textures are sampled smoothly. A picture over the size budget
     *   is drawn at a lower resolution to fit it (a half, a quarter and so
     *   on). That is faster, and the picture is smaller. But every detail
     *   finer than a picture pixel is averaged away, so a change that small
     *   can pass unseen. The run's summary lists every picture drawn that
     *   way.
     *
     * A smooth view tested as `'pixel'` comes out jagged. That is not how its
     * game draws it, but the result is consistent, and plain to see in
     * review. The games' spritesheets are sampled nearest-neighbour whatever
     * the style.
     */
    readonly artStyle?: ArtStyle;
}

/** How a view's art is drawn. See `PixiPictureOptions.artStyle`. */
export type ArtStyle = 'pixel' | 'smooth';

/**
 * A picture's pixels, read back from the renderer. They are opaque RGBA,
 * with rows from the top.
 */
export interface PixiPicture {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;
    /** Picture pixels per view pixel. This is 1, or less for a big smooth view. */
    readonly resolution: number;
    /** Whether every pixel is the background's, which means the view drew nothing inside the picture. */
    readonly isBlank: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Sets the defaults that a pose's textures are made with. Call it before the
 * pose runs. Each entry sets these defaults for itself, and a test must not
 * inherit the last test's. The games' spritesheets set their own, which are
 * nearest-neighbour.
 */
export function preparePixiPose(options: PixiPictureOptions): void {
    TextureSource.defaultOptions.scaleMode = options.artStyle === 'smooth' ? 'linear' : 'nearest';
}

/**
 * Draws a refreshed view into a render texture and reads its pixels back.
 * It takes no screenshot. The pixels are the renderer's own, with no
 * compositor or colour management in between. It throws if the picture is
 * over the size budget and cannot be drawn smaller.
 */
export async function drawPixiPicture(view: Container, options: PixiPictureOptions & { readonly maxPixels: number }): Promise<PixiPicture> {
    const isSmooth = options.artStyle === 'smooth';
    const app = await ensureApp(isSmooth);
    holder.position.set(0, 0);
    holder.addChild(view);
    try {
        let x0 = 0;
        let y0 = 0;
        let width = options.width;
        let height = options.height;
        if (width === undefined || height === undefined) {
            // Use the holder's bounds, so that the view's own position counts.
            // A view's local bounds leave its position out.
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
        const target = ensureTarget(width, height, fit.resolution, isSmooth);
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

/** The space added around a view's bounds, so that an antialiased edge or a glow at them is in the picture. */
const MARGIN = 4;
const DEFAULT_BACKGROUND = 0x202024;

/**
 * The stage that every picture is drawn from. It holds a backdrop, then a
 * holder for the view. The holder is moved by the view's bounds.
 */
const stage = new Container();
const backdrop = new Graphics();
const holder = new Container();
stage.addChild(backdrop, holder);

let app: Promise<Application> | undefined;
const targets = new Map<string, RenderTexture>();

/**
 * Returns the one renderer that draws every picture. It is made on first
 * use and kept. MSAA (multisample antialiasing) belongs to each picture's
 * render texture, and whole-pixel positions are set for each picture. The
 * renderer's WebGL context has its own antialiasing, which is fixed to off.
 * That setting changes MSAA edges in render textures too, so it must never
 * be left to a default.
 */
async function ensureApp(isSmooth: boolean): Promise<Application> {
    app ??= (async () => {
        const made = new Application();
        await made.init({ width: 8, height: 8, antialias: false, autoStart: false, preference: 'webgl', sharedTicker: false });
        return made;
    })();
    const ready = await app;
    // The renderer reads this field every frame. Pixi offers no setter for it.
    (ready.renderer as unknown as { _roundPixels: number })._roundPixels = isSmooth ? 0 : 1;
    return ready;
}

/**
 * Returns the render texture for a size, resolution and antialiasing. Each
 * one is made on first use and kept. So the canvas is never resized, and no
 * texture is made for each test.
 */
function ensureTarget(width: number, height: number, resolution: number, isAntialiased: boolean): RenderTexture {
    const key = `${width}x${height}@${resolution}${isAntialiased ? 'aa' : ''}`;
    let target = targets.get(key);
    if (target === undefined) {
        target = RenderTexture.create({ width, height, resolution, antialias: isAntialiased });
        targets.set(key, target);
    }
    return target;
}
