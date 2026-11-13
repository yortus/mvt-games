import { BatchableGraphics, type BitmapFont, BitmapFontManager, Cache, Container } from 'pixi.js';
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
    /** The background of each test whose options don't set one, as a number such as `0x202024` or a CSS colour. */
    readonly background?: number | string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the kind of view for Pixi containers, which a project lists in its
 * `vsnap.config.ts`. Its tests give `kind: 'pixi'`, unless it is the
 * project's default kind, and their poses return Pixi containers. A view is
 * drawn as pixel art if its test's options say so, or else if these options
 * say so. Otherwise it is drawn smooth.
 */
export function pixiViews(options: PixiViewsOptions = {}): CanvasViewKind<Container, PixiImageOptions, 'pixi'> {
    // The project's vsnap.config.ts calls this before any test file loads,
    // so every font that Pixi makes for itself is seen.
    watchBitmapFonts();
    return {
        kind: 'pixi',
        isView: (value) => value instanceof Container,
        defaults: { pixelArt: options.pixelArt, background: options.background },
        // The pose makes its textures with the defaults that this sets, and
        // its bitmap text with fonts of its own.
        beforePose: (imageOptions) => {
            patchPixiPools();
            forgetBitmapFonts();
            preparePixiPose(imageOptions);
        },
        prepare: options.prepare,
        draw: drawPixiImage,
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

/** The bitmap fonts that Pixi made for itself, for `BitmapText` in a family that no installed font has. */
const madeFonts = new Set<BitmapFont>();

let isWatching = false;

/**
 * Starts noting each bitmap font that Pixi makes for itself, once per page.
 * A `BitmapText` whose family has no installed font gets one that Pixi
 * makes the first time it is asked for, and keeps for the page's life. Its
 * glyphs are packed into a texture in the order that they are first asked
 * for, and the texture is mipmapped. So small text is drawn from a mipmap,
 * where each glyph blends with its neighbours, and those depend on the text
 * that earlier tests drew. A font that the project installs by name, with
 * `BitmapFont.install`, is the project's own, and isn't noted.
 */
function watchBitmapFonts(): void {
    if (isWatching) return;
    isWatching = true;
    const getFont = BitmapFontManager.getFont.bind(BitmapFontManager);
    BitmapFontManager.getFont = (text, style) => {
        const font = getFont(text, style);
        // Pixi looks up an installed font by this name first.
        const installedName = `${style.fontFamily}-bitmap`;
        const isInstalled = Cache.has(installedName) && Cache.get(installedName) === font;
        if (!isInstalled && !madeFonts.has(font)) {
            madeFonts.add(font);
            font.once('destroy', () => madeFonts.delete(font));
        }
        return font;
    };
}

/**
 * Destroys the bitmap fonts that Pixi made for itself, and forgets the
 * layouts that it laid out with them. Pixi makes each one afresh when a
 * test next asks for it, holding only that test's glyphs, in the order
 * that it asks for them. So the test's image doesn't depend on the tests
 * before it.
 */
function forgetBitmapFonts(): void {
    if (madeFonts.size === 0) return;
    // Destroying a font takes it out of Pixi's cache, and out of the set.
    for (const font of [...madeFonts]) font.destroy();
    BitmapFontManager.measureCache.clear();
}
