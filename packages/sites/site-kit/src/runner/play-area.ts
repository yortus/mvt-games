// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where an entry plays within the area it is given: scaled to fit, and
 * centred. The stage spans the whole area, in the entry's own pixels, so
 * anything drawn around the play area (touch controls) has room.
 */
export interface PlayArea {
    /** CSS pixels per entry pixel. */
    readonly scale: number;
    /** The whole area, in entry pixels. */
    readonly stageWidth: number;
    readonly stageHeight: number;
    /** The play area's top left corner on the stage, in entry pixels. */
    readonly offsetX: number;
    readonly offsetY: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlayAreaOptions {
    /** The area given, in CSS pixels. */
    readonly areaWidth: number;
    readonly areaHeight: number;
    /** The entry's play area, in its own pixels. */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /** Scale by whole numbers only, from 1x up, for crisp pixel art. Ignored when `hasTouchControls`. */
    readonly integerScale?: boolean;
    /** Leave room beside or below the play area for touch controls. */
    readonly hasTouchControls?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Fits an entry's play area into the area given. With touch controls, it
 * keeps a margin for them below the play area or beside it, whichever leaves
 * the play area larger, so the scale changes smoothly as the area turns from
 * portrait to landscape; in portrait, the play area sits at the top.
 */
export function fitPlayArea(options: PlayAreaOptions): PlayArea {
    const { areaWidth, areaHeight, screenWidth, screenHeight } = options;
    const hasTouchControls = options.hasTouchControls ?? false;

    // The largest scale that fits the play area wholly in the area
    const maxFitScale = Math.min(areaWidth / screenWidth, areaHeight / screenHeight);

    let scale = maxFitScale;
    if (hasTouchControls) {
        const portraitScale = Math.min(areaWidth / screenWidth, (areaHeight - TOUCH_MARGIN * 2) / screenHeight);
        const landscapeScale = Math.min((areaWidth - TOUCH_MARGIN * 2) / screenWidth, areaHeight / screenHeight);
        // Never smaller than MIN_TOUCH_SCALE, and never larger than fits
        scale = Math.min(maxFitScale, Math.max(MIN_TOUCH_SCALE, Math.max(portraitScale, landscapeScale)));
    }
    else if (options.integerScale && scale >= 1) {
        scale = Math.floor(scale);
    }
    if (!(scale > 0)) scale = 1;

    const stageWidth = Math.ceil(areaWidth / scale);
    const stageHeight = Math.ceil(areaHeight / scale);
    const offsetX = Math.floor((stageWidth - screenWidth) / 2);
    const isPortrait = areaHeight > areaWidth;
    const offsetY = hasTouchControls && isPortrait ? 0 : Math.floor((stageHeight - screenHeight) / 2);
    return { scale, stageWidth, stageHeight, offsetX, offsetY };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The margin kept for touch controls, in CSS pixels. */
const TOUCH_MARGIN = 80;

/** The smallest scale touch controls may squeeze the play area to. */
const MIN_TOUCH_SCALE = 0.3;
