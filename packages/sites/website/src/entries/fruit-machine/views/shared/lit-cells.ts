import { ROW_COUNT } from '../../data';
import type { CelebrationModel, WayWin } from '../../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which cells of the window the celebration's current step shows off. */
export interface LitCells {
    /** True for a cell on the step's way, or on any way during the opener. False when not celebrating. */
    isLitAt: (reel: number, row: number) => boolean;
    /** True when any cell is lit. */
    readonly isAnyLit: boolean;
}

export interface LitCellsOptions {
    readonly celebration: CelebrationModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Works out the lit cells once per celebration step, as a bitmask, so a view
 * can ask about every cell every frame for the cost of a comparison. The
 * opener can have hundreds of ways to merge; a step changes a few times a
 * second at most.
 */
export function createLitCells(options: LitCellsOptions): LitCells {
    const { celebration } = options;
    let maskedWins: readonly WayWin[] | undefined;
    let maskedStep = -1;
    let mask = 0;

    return {
        isLitAt(reel, row) {
            return (currentMask() & (1 << (reel * ROW_COUNT + row))) !== 0;
        },
        get isAnyLit() {
            return currentMask() !== 0;
        },
    };

    function currentMask(): number {
        if (celebration.wins !== maskedWins || celebration.stepIndex !== maskedStep) {
            maskedWins = celebration.wins;
            maskedStep = celebration.stepIndex;
            mask = maskOf(celebration);
        }
        return mask;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function maskOf(celebration: CelebrationModel): number {
    if (!celebration.isActive) return 0;
    if (celebration.win !== undefined) return maskOfWay(celebration.win);
    let mask = 0;
    for (let i = 0; i < celebration.wins.length; i++) mask |= maskOfWay(celebration.wins[i]);
    return mask;
}

function maskOfWay(win: WayWin): number {
    let mask = 0;
    for (let reel = 0; reel < win.rows.length; reel++) mask |= 1 << (reel * ROW_COUNT + win.rows[reel]);
    return mask;
}
