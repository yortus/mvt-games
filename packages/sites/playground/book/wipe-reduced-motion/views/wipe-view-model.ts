// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The cover that hides the change from one level to the next. On the full
 * path, it sweeps in from the left and out to the right. On the quiet path,
 * for a player who asked for less motion, it fades to black where it
 * stands, and back. Both follow the model's progress, so the wipe takes as
 * long either way.
 */
export interface WipeViewModel {
    /** Where the cover is, and how opaque. The view copies these onto the real cover. */
    readonly cover: { readonly x: number; readonly alpha: number };
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WipeViewModelOptions {
    readonly phase: () => 'playing' | 'wiping';
    /** How far through the wipe the game is, from 0 to 1. */
    readonly progress: () => number;
    /** Whether the player asked for less motion. It's read as each wipe starts. */
    readonly isMotionReduced: () => boolean;
    /** The width of the screen the cover sweeps across, in pixels. */
    readonly screenWidth: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the wipe's presentation state, worked out once as it's made, so it starts valid. */
export function createWipeViewModel(options: WipeViewModelOptions): WipeViewModel {
    const { screenWidth } = options;
    // A plain record of two numbers, not the display object
    const cover = { x: 0, alpha: 0 };
    let wasWiping = false;
    let isQuiet = false;

    const wipe: WipeViewModel = {
        cover,
        update: (_deltaMs) => {
            const isWiping = options.phase() === 'wiping';
            if (isWiping && !wasWiping) isQuiet = options.isMotionReduced();
            wasWiping = isWiping;
            const progress = options.progress();
            if (isQuiet) {
                // Fade to black where it stands, and back
                cover.x = 0;
                cover.alpha = 1 - Math.abs(2 * progress - 1);
            }
            else {
                // Sweep in from the left, and out to the right
                cover.x = (2 * progress - 1) * screenWidth;
                cover.alpha = 1;
            }
        },
    };

    wipe.update(0);
    return wipe;
}
