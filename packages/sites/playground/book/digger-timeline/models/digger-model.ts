import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How fast the digger walks, in tiles per second. */
const SPEED = 4;
/** How far the harpoon reaches, in tiles. */
const HARPOON_TILES = 2.5;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which way the digger faces. */
export type Facing = 'left' | 'right' | 'up' | 'down';

/**
 * A digger in a field of dirt, which walks a tile at a time toward the tile
 * it's sent to, digging a tunnel as it goes. It can fire a harpoon the way it
 * faces, and it stands still while the harpoon is out. Positions are in
 * tiles, and fractional while the digger is between tiles.
 */
export interface DiggerModel {
    readonly rows: number;
    readonly cols: number;
    readonly row: number;
    readonly col: number;
    readonly facing: Facing;
    /** How far the harpoon reaches, in tiles, and 0 while it's in. */
    readonly harpoonLength: number;
    readonly isDugAt: (row: number, col: number) => boolean;
    /** Sends the digger toward a tile. It walks across first, then up or down. */
    readonly walkTo: (row: number, col: number) => void;
    /** Fires the harpoon, unless it's already out. */
    readonly fireHarpoon: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a digger at the left of the field, with the tunnel it starts in. */
export function createDiggerModel(): DiggerModel {
    // The digger's values, which the timelines' tweens change
    const state = {
        row: START_ROW,
        col: START_COL,
        facing: 'right' as Facing,
        moving: false,
        harpoonExtended: false,
        harpoonLength: 0,
    };
    let targetRow = START_ROW;
    let targetCol = START_COL;
    const dug: boolean[] = [];
    for (let i = 0; i < ROWS * COLS; i++) dug.push(false);
    dug[START_ROW * COLS + START_COL] = true;

    // Created paused, so GSAP's own clock never moves them. `update` does.
    const timeline = gsap.timeline({
        paused: true,              // GSAP's own clock leaves it alone
        autoRemoveChildren: true,  // finished tweens are removed for you
    });
    const harpoonTimeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    const model: DiggerModel = {
        rows: ROWS,
        cols: COLS,
        get row() { return state.row; },
        get col() { return state.col; },
        get facing() { return state.facing; },
        get harpoonLength() { return state.harpoonLength; },
        isDugAt: (row, col) => dug[row * COLS + col],

        walkTo(row, col) {
            targetRow = Math.min(Math.max(row, 0), ROWS - 1);
            targetCol = Math.min(Math.max(col, 0), COLS - 1);
        },

        fireHarpoon() {
            if (state.harpoonExtended) return;
            scheduleHarpoon();
        },

        update(deltaMs) {
            // 1. Advance every timeline
            const dt = deltaMs / 1000;
            timeline.time(timeline.time() + dt);
            harpoonTimeline.time(harpoonTimeline.time() + dt);

            // 2. Orchestrate: start the next move when the last one is done
            if (!state.moving && !state.harpoonExtended) scheduleMove();
        },
    };

    return model;

    function scheduleMove(): void {
        // Across first, then up or down, or stay put once there
        let nextRow = state.row;
        let nextCol = state.col;
        if (state.col !== targetCol) nextCol += Math.sign(targetCol - state.col);
        else if (state.row !== targetRow) nextRow += Math.sign(targetRow - state.row);
        else return;
        state.facing = toFacing(nextRow - state.row, nextCol - state.col);
        dug[nextRow * COLS + nextCol] = true;

        state.moving = true;
        const dist = Math.abs(nextCol - state.col)
            + Math.abs(nextRow - state.row) || 0.001;
        const duration = dist / SPEED; // SPEED is in tiles per second
        const t = timeline.time();

        timeline.to(
            state,
            { col: nextCol, row: nextRow, duration, ease: 'none' },
            t,
        );
        timeline.set(state, { moving: false }, t + duration);
    }

    function scheduleHarpoon(): void {
        state.harpoonExtended = true;
        const t = harpoonTimeline.time();
        // Out fast, a short hold, then back in
        harpoonTimeline.to(state, { harpoonLength: HARPOON_TILES, duration: 0.18, ease: 'power2.out' }, t);
        harpoonTimeline.to(state, { harpoonLength: 0, duration: 0.22, ease: 'power2.in' }, t + 0.38);
        harpoonTimeline.set(state, { harpoonExtended: false }, t + 0.6);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ROWS = 6;
const COLS = 11;
const START_ROW = 1;
const START_COL = 0;

/** The way a step of one tile faces. */
function toFacing(rowStep: number, colStep: number): Facing {
    if (colStep > 0) return 'right';
    if (colStep < 0) return 'left';
    return rowStep > 0 ? 'down' : 'up';
}
