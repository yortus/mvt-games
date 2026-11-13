import { BlurFilter, Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns `shape`, blurred by `strength`, in a container kept as a texture,
 * so it is blurred once, however often it is drawn, and only its own
 * brightness, place and turn change from frame to frame. The container's
 * bounds are widened by an all but clear rectangle, as far as the blur
 * reaches, since the texture is only as large as its bounds, and would cut
 * the blur's soft edges off.
 */
export function keepBlurred(shape: Graphics, strength: number): Container {
    shape.filters = [new BlurFilter({ strength, quality: BLUR_QUALITY })];
    const bounds = shape.getLocalBounds();
    const reach = strength * BLUR_REACH;
    const room = new Graphics()
        .rect(bounds.minX - reach, bounds.minY - reach, bounds.maxX - bounds.minX + reach * 2, bounds.maxY - bounds.minY + reach * 2)
        .fill({ color: 0x000000, alpha: CLEAR_ALPHA });
    const kept = new Container();
    kept.addChild(room, shape);
    kept.cacheAsTexture(true);
    return kept;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many passes the blur takes, each way, for a smoother blur. */
const BLUR_QUALITY = 4;
/** How far a blur reaches, for each 1 of its strength, and an alpha too small to show, but not left out as clear. */
const BLUR_REACH = 3;
const CLEAR_ALPHA = 0.001;
