import type { DustDevilModel } from './dust-devil-model';
import { SHEEP_FLEE_DISTANCE, SHEEP_FLEE_SPEED, SHEEP_RADIUS, SHEEP_WALK_SPEED } from './model-constants';
import type { Random } from './random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Out in the meadow, a sheep grazes, ambles, or runs from a dust devil
 * (`fleeing`). Fenced into pasture, it is `penned`, and safe. One still out
 * in the meadow when the round is cleared is `lost` to the storm.
 */
export type SheepPhase = 'grazing' | 'walking' | 'fleeing' | 'penned' | 'lost';

/**
 * A sheep in the meadow. It wanders its own region, never crossing a fence,
 * and runs from any dust devil that comes near.
 */
export interface SheepModel {
    readonly phase: SheepPhase;
    /** Its middle, in cells. */
    readonly row: number;
    readonly col: number;
    /** Whether it faces left, the way it last moved. */
    readonly isFacingLeft: boolean;
    update: (deltaMs: number) => void;
    /** Pens it, fenced into pasture. */
    pen: () => void;
    /** Loses it to the storm. */
    lose: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SheepModelOptions {
    readonly row: number;
    readonly col: number;
    readonly random: Random;
    /** The meadow region of cell (row, col), or -1 for a cell that is not meadow. */
    readonly regionAt: (row: number, col: number) => number;
    /** The dust devils it runs from. It needs only where each is, and whether it still whirls. */
    readonly devils: () => readonly Pick<DustDevilModel, 'phase' | 'row' | 'col'>[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sheep, grazing. */
export function createSheepModel(options: SheepModelOptions): SheepModel {
    const { random, regionAt, devils } = options;

    let phase: SheepPhase = 'grazing';
    let row = options.row;
    let col = options.col;
    let heading = 0;
    let isFacingLeft = random.next() < 0.5;
    let msLeft = random.between(GRAZE_MIN_MS, GRAZE_MAX_MS);

    const model: SheepModel = {
        get phase() { return phase; },
        get row() { return row; },
        get col() { return col; },
        get isFacingLeft() { return isFacingLeft; },

        update(deltaMs) {
            if (phase === 'penned' || phase === 'lost') return;
            if (fleeFromNearestDevil()) {
                phase = 'fleeing';
                amble(SHEEP_FLEE_SPEED * deltaMs * 0.001);
                return;
            }
            if (phase === 'fleeing') startGrazing();
            msLeft -= deltaMs;
            if (msLeft <= 0) {
                if (phase === 'grazing') startWalking();
                else startGrazing();
            }
            if (phase === 'walking') amble(SHEEP_WALK_SPEED * deltaMs * 0.001);
        },

        pen() {
            phase = 'penned';
        },

        lose() {
            if (phase !== 'penned') phase = 'lost';
        },
    };

    return model;

    function startGrazing(): void {
        phase = 'grazing';
        msLeft = random.between(GRAZE_MIN_MS, GRAZE_MAX_MS);
    }

    function startWalking(): void {
        phase = 'walking';
        heading = random.between(0, Math.PI * 2);
        msLeft = random.between(WALK_MIN_MS, WALK_MAX_MS);
    }

    /** Heads away from the nearest dust devil, if one is close, and returns whether one is. */
    function fleeFromNearestDevil(): boolean {
        const all = devils();
        let nearest = SHEEP_FLEE_DISTANCE * SHEEP_FLEE_DISTANCE;
        let found = false;
        for (let i = 0; i < all.length; i++) {
            const devil = all[i];
            if (devil.phase !== 'whirling') continue;
            const dRow = row - devil.row;
            const dCol = col - devil.col;
            const distanceSquared = dRow * dRow + dCol * dCol;
            if (distanceSquared >= nearest) continue;
            nearest = distanceSquared;
            heading = Math.atan2(dRow, dCol);
            found = true;
        }
        return found;
    }

    /** Moves `distance` along its heading, one axis at a time, turning aside at fences. */
    function amble(distance: number): void {
        const home = regionAt(Math.floor(row), Math.floor(col));
        const dCol = Math.cos(heading) * distance;
        const dRow = Math.sin(heading) * distance;
        if (Math.abs(dCol) > 0.001) isFacingLeft = dCol < 0;
        if (regionAt(Math.floor(row), Math.floor(col + dCol + Math.sign(dCol) * SHEEP_RADIUS)) === home) col += dCol;
        else if (phase === 'walking') heading = Math.PI - heading;
        if (regionAt(Math.floor(row + dRow + Math.sign(dRow) * SHEEP_RADIUS), Math.floor(col)) === home) row += dRow;
        else if (phase === 'walking') heading = -heading;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const GRAZE_MIN_MS = 1200;
const GRAZE_MAX_MS = 4000;
const WALK_MIN_MS = 700;
const WALK_MAX_MS = 2200;
