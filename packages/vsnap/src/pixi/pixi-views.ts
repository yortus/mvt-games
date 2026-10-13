import { BatchableGraphics, Container } from 'pixi.js';
import type { CanvasViewKind } from '../browser';
import { drawPixiImage, type PixiImageOptions, preparePixiPose } from './pixi-image';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a project does to its Pixi views around each image. */
export interface PixiViewsOptions {
    /**
     * Prepares a view after its pose returns it, and before its image is
     * taken. A view that writes its state to its display objects in a
     * separate step, such as a refresh, does that step here.
     */
    readonly prepare?: (view: Container) => void;
    /** Disposes of a view after its image is taken. By default, it is Pixi's `destroy({ children: true })`. */
    readonly dispose?: (view: Container) => void;
    /**
     * Whether the views are pixel art, for each test whose options don't
     * say. A project whose views are mostly pixel art sets `true` here, and
     * a test of a smooth view says `pixelArt: false`. The default is `false`.
     * See `PixiImageOptions.pixelArt` for what it means for the image.
     */
    readonly pixelArt?: boolean;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the kind of view for Pixi containers, which a project lists in its
 * `vsnap.config.ts`. Its tests give `kind: 'pixi'`, unless it is the
 * project's default view, and their poses return Pixi containers. A view is
 * drawn as pixel art if its test's options say so, or else if these options
 * say so. Otherwise it is drawn smooth.
 */
export function pixiViews(options: PixiViewsOptions = {}): CanvasViewKind<Container, PixiImageOptions, 'pixi'> {
    const { pixelArt } = options;
    // A test's options, with the project's pixelArt if they don't say.
    const withPixelArt = <O extends PixiImageOptions>(imageOptions: O): O => (imageOptions.pixelArt === undefined && pixelArt !== undefined ? { ...imageOptions, pixelArt } : imageOptions);
    return {
        name: 'pixi',
        kind: 'canvas',
        isView: (value) => value instanceof Container,
        // The pose makes its textures with the defaults that this sets.
        beforePose: (imageOptions) => {
            patchPixiPools();
            preparePixiPose(withPixelArt(imageOptions));
        },
        prepare: options.prepare,
        draw: (view, imageOptions) => drawPixiImage(view, withPixelArt(imageOptions)),
        dispose: options.dispose ?? ((view) => view.destroy({ children: true })),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let isPatched = false;

/**
 * Patches a Pixi bug that lets one actual image change the next, once per
 * page. In Pixi 8.21, `BatchableGraphics.reset()` leaves `roundPixels` as
 * it was. So a batch that a rounded (pixel-art) graphic returned to the
 * pool rounds the curves of the next graphics context built from the pool.
 * This patch clears `roundPixels` on reset, until Pixi does that itself.
 */
function patchPixiPools(): void {
    if (isPatched) return;
    isPatched = true;
    const reset = BatchableGraphics.prototype.reset;
    BatchableGraphics.prototype.reset = function (this: BatchableGraphics) {
        reset.call(this);
        this.roundPixels = 0;
    };
}
