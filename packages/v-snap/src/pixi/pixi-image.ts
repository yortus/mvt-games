import { Application, Container, Graphics, type Renderer, RenderTexture, TextureSource } from 'pixi.js';
import type { CanvasImage } from '../browser';
import { fitImage, useCached } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PixiImageOptions {
    /**
     * The image's size in the view's pixels. Each axis is framed on its own.
     * One with a size runs from 0 to that size, as a game's screen does. One
     * without is framed by the view's bounds after its first refresh, plus
     * a margin of 4 pixels. So `{ width: 320 }` gives the screen's width,
     * and the view's own height.
     */
    readonly width?: number;
    readonly height?: number;
    /**
     * The colour behind the view, as a number such as `0x202024` or a CSS
     * colour. By default, it is one opaque dark grey, the same for every
     * test, so that transparent areas show.
     */
    readonly background?: number | string;
    /**
     * Whether the view is pixel art. Set it as the view's game draws it. The
     * default is the one that `pixiViews` sets for the project, or else
     * `false`.
     *
     * - Pixel art has hard edges (no antialiasing), and positions rounded to
     *   whole pixels. The textures that the pose makes are sampled
     *   nearest-neighbour, so a magnified image stays blocky. The image is
     *   always drawn at full size. An image over the size budget (v-snap's
     *   `maxPixels` option) fails, since drawing pixel art smaller would
     *   drop whole texels (texture pixels). Crop it (`width`, `height`) or
     *   pose part of the view instead.
     * - Other art is drawn smooth, with antialiased edges and fractional
     *   positions, and the pose's textures are sampled smoothly. An image
     *   over the size budget is drawn at a lower resolution to fit it (a
     *   half, a quarter and so on). That is faster, and the image is
     *   smaller. But every detail finer than an image pixel is averaged
     *   away, so a change that small can pass unseen. The run's summary
     *   lists every image drawn that way.
     *
     * Pixel art drawn smooth comes out blurred, and smooth art drawn as pixel
     * art comes out jagged. Neither is how the game draws it, but the result
     * is consistent, and plain to see in review. A texture that sets its own
     * sampling, such as a spritesheet's, keeps it, either way.
     */
    readonly pixelArt?: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Sets the defaults that a pose's textures are made with. Call it before the
 * pose runs. Each game sets these defaults for itself, and a test must not
 * inherit the last test's. A spritesheet can set its own sampling, which
 * these defaults then do not change. It also notes whether the test is of
 * pixel art, for `getPixiRenderer`.
 */
export function preparePixiPose(options: PixiImageOptions): void {
    isPosePixelArt = options.pixelArt === true;
    TextureSource.defaultOptions.scaleMode = isPosePixelArt ? 'nearest' : 'linear';
}

/**
 * Returns the Pixi renderer that draws every actual image, for a view that
 * needs one to build itself, such as one that calls `generateTexture`. It
 * is made on first use and kept for the page's life, so a test mustn't
 * resize it, destroy it or change its settings. A texture that it makes is
 * the test's to destroy. It rounds positions to whole pixels if the test
 * is of pixel art, and not otherwise, rather than as the last image left
 * it, so that what the pose makes with it doesn't depend on the test
 * before.
 */
export async function getPixiRenderer(): Promise<Renderer> {
    const ready = await ensureApp();
    setRoundPixels(ready, isPosePixelArt);
    return ready.renderer;
}

/**
 * Draws a refreshed view into a render texture and reads its pixels back.
 * It takes no screenshot. The pixels are the renderer's own, with no
 * compositor or colour management in between. It throws if the image is
 * over the size budget and cannot be drawn smaller.
 */
export async function drawPixiImage(view: Container, options: PixiImageOptions & { readonly maxPixels: number }): Promise<CanvasImage> {
    const isSmooth = options.pixelArt !== true;
    const app = await ensureApp();
    setRoundPixels(app, !isSmooth);
    holder.position.set(0, 0);
    holder.addChild(view);
    try {
        // Each axis on its own: one with a size runs from 0 to that size, and
        // one without is framed by the view's bounds, plus a margin. The
        // holder's bounds count the view's own position, which a view's local
        // bounds leave out.
        const bounds = options.width === undefined || options.height === undefined ? holder.getLocalBounds() : undefined;
        const x0 = bounds === undefined || options.width !== undefined ? 0 : Math.floor(bounds.minX) - MARGIN;
        const y0 = bounds === undefined || options.height !== undefined ? 0 : Math.floor(bounds.minY) - MARGIN;
        const width = options.width ?? (bounds === undefined ? 0 : Math.ceil(bounds.maxX) + MARGIN - x0);
        const height = options.height ?? (bounds === undefined ? 0 : Math.ceil(bounds.maxY) + MARGIN - y0);
        const fit = fitImage({ width, height, maxPixels: options.maxPixels, canScale: isSmooth, advice: PIXEL_ART_ADVICE });
        if ('problem' in fit) throw new Error(fit.problem);
        holder.position.set(-x0, -y0);
        backdrop.clear().rect(0, 0, width, height).fill(options.background ?? DEFAULT_BACKGROUND);
        const target = ensureTarget(width, height, fit.resolution, isSmooth);
        app.renderer.render({ container: stage, target, clear: true });
        const read = app.renderer.texture.getPixels(target);
        const pixels = new Uint8Array(read.pixels.buffer, read.pixels.byteOffset, read.pixels.byteLength);
        return { width: read.width, height: read.height, pixels, resolution: fit.resolution };
    }
    finally {
        holder.removeChildren();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The space added around a view's bounds, so that an antialiased edge or a glow at them is in the image. */
const MARGIN = 4;
const DEFAULT_BACKGROUND = 0x202024;

const PIXEL_ART_ADVICE = 'Pixel art is drawn at full size, so crop the image (width, height) or pose part of the view. '
    + 'A view that isn\'t pixel art (pixelArt: false) is drawn at a lower resolution to fit instead.';

/**
 * The stage that every actual image is rendered from. It holds a backdrop, then a
 * holder for the view. The holder is moved by the view's bounds.
 */
const stage = new Container();
const backdrop = new Graphics();
const holder = new Container();
stage.addChild(backdrop, holder);

let app: Promise<Application> | undefined;

/** Whether the running test is of pixel art, as `preparePixiPose` noted. */
let isPosePixelArt = false;
const targets = new Map<string, RenderTexture>();

/**
 * Returns the application whose renderer draws every actual image. It is
 * made on first use and kept. MSAA (multisample antialiasing) belongs to
 * each image's render texture, and whole-pixel positions are set for each
 * image, by `setRoundPixels`. The renderer's WebGL context has its own
 * antialiasing, which is fixed to off. That setting changes MSAA edges in
 * render textures too, so it must never be left to a default.
 */
function ensureApp(): Promise<Application> {
    app ??= (async () => {
        const made = new Application();
        await made.init({ width: 8, height: 8, antialias: false, autoStart: false, preference: 'webgl', sharedTicker: false });
        return made;
    })();
    return app;
}

/** Sets whether the renderer rounds positions to whole pixels, for pixel art, or not, for smooth art. */
function setRoundPixels(app: Application, isRounded: boolean): void {
    // The renderer reads this internal field every frame, and Pixi offers no
    // setter for it. Pixi's types declare it, so a rename fails the type check,
    // and a test checks that the renderer still reads it.
    app.renderer._roundPixels = isRounded ? 1 : 0;
}

/**
 * Returns the render texture for a size, resolution and antialiasing. Each
 * one is made on first use and kept, for the most recent sizes. So the
 * canvas is never resized, and no texture is made for each test.
 */
function ensureTarget(width: number, height: number, resolution: number, isAntialiased: boolean): RenderTexture {
    return useCached(targets, {
        key: `${width}x${height}@${resolution}${isAntialiased ? 'aa' : ''}`,
        limit: TARGET_LIMIT,
        create: () => RenderTexture.create({ width, height, resolution, antialias: isAntialiased }),
        release: (target) => target.destroy(true),
    });
}

/** The most render textures that the page keeps, one for each size of image that recent tests drew. */
const TARGET_LIMIT = 16;
