import { DEVIL_BLOW_OUT_MS, DEVIL_FULL_ROOM, DEVIL_MIN_SIZE, DEVIL_RADIUS, DEVIL_STARVING_ROOM } from './model-constants';
import type { Random } from './random';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whirling across the meadow, blowing itself out, or gone. */
export type DustDevilPhase = 'whirling' | 'blowing-out' | 'gone';

/**
 * A dust devil: a whirlwind that wanders the open meadow, turning this way
 * and that, and bouncing off the fences. It stays in its own region of the
 * meadow. It snaps any wire it touches. It feeds on open meadow: the less
 * room its region gives it, the smaller it is, and fenced into a small
 * enough region, it blows itself out.
 */
export interface DustDevilModel {
    readonly phase: DustDevilPhase;
    /** Its middle, in cells. */
    readonly row: number;
    readonly col: number;
    /** How far from its middle, in cells, it catches a wire or the farmhand. It shrinks with its size. */
    readonly radius: number;
    /**
     * How big it is, from `DEVIL_MIN_SIZE` to 1. It is full size with plenty
     * of room, and shrinks as its region does.
     */
    readonly size: number;
    /** Whether it is close to blowing out: its region less than twice the size at which it does. */
    readonly isStarving: boolean;
    /** How far it has blown itself out, from 0 to 1. */
    readonly blowOutProgress: number;
    update: (deltaMs: number) => void;
    /** Starts it blowing itself out. Once it starts, it is harmless. */
    blowOut: () => void;
    /** Tells it how much room it has: its region's cells, as a multiple of the region at which it blows out. */
    setRoom: (room: number) => void;
}

/** Something a dust devil may lean towards. */
export interface DevilTarget {
    readonly row: number;
    readonly col: number;
    /** Whether it can be caught out in the meadow: the farmhand with wire out. */
    readonly isExposed: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DustDevilModelOptions {
    readonly row: number;
    readonly col: number;
    /** Cells per second. */
    readonly speed: number;
    /** How strongly it turns towards `target` while the target is exposed, from 0 to 1. */
    readonly chase: number;
    readonly target: DevilTarget;
    readonly random: Random;
    /** The meadow region of cell (row, col), or -1 for a cell that is not meadow. */
    readonly regionAt: (row: number, col: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a dust devil, whirling off in a random direction. */
export function createDustDevilModel(options: DustDevilModelOptions): DustDevilModel {
    const { speed, chase, target, random, regionAt } = options;

    let phase: DustDevilPhase = 'whirling';
    let row = options.row;
    let col = options.col;
    let heading = random.between(0, Math.PI * 2);
    let msToTurn = random.between(TURN_MIN_MS, TURN_MAX_MS);
    let blowOutMs = 0;
    let room = DEVIL_FULL_ROOM;

    const model: DustDevilModel = {
        get phase() { return phase; },
        get row() { return row; },
        get col() { return col; },
        get radius() { return DEVIL_RADIUS * model.size; },
        get size() {
            const share = Math.max(0, Math.min(1, (room - 1) / (DEVIL_FULL_ROOM - 1)));
            return DEVIL_MIN_SIZE + (1 - DEVIL_MIN_SIZE) * share;
        },
        get isStarving() { return phase === 'whirling' && room < DEVIL_STARVING_ROOM; },
        get blowOutProgress() { return phase === 'whirling' ? 0 : Math.min(1, blowOutMs / DEVIL_BLOW_OUT_MS); },

        update(deltaMs) {
            if (phase === 'gone') return;
            if (phase === 'blowing-out') {
                blowOutMs += deltaMs;
                if (blowOutMs >= DEVIL_BLOW_OUT_MS) phase = 'gone';
                return;
            }
            msToTurn -= deltaMs;
            if (msToTurn <= 0) {
                turn();
                msToTurn = random.between(TURN_MIN_MS, TURN_MAX_MS);
            }
            whirlAlong(speed * deltaMs * 0.001);
        },

        blowOut() {
            if (phase === 'whirling') phase = 'blowing-out';
        },

        setRoom(newRoom) {
            room = newRoom;
        },
    };

    return model;

    /** Turns a random amount, leaning towards the target if it is exposed. */
    function turn(): void {
        heading += random.between(-MAX_TURN, MAX_TURN);
        if (chase > 0 && target.isExposed) {
            const towards = Math.atan2(target.row - row, target.col - col);
            let difference = towards - heading;
            difference -= Math.PI * 2 * Math.round(difference / (Math.PI * 2));
            heading += difference * chase;
        }
    }

    /**
     * Moves `distance` along its heading, one axis at a time. Where its
     * leading edge would leave its region, it bounces off instead.
     */
    function whirlAlong(distance: number): void {
        const home = regionAt(Math.floor(row), Math.floor(col));
        const dCol = Math.cos(heading) * distance;
        const dRow = Math.sin(heading) * distance;
        const edge = model.radius * EDGE_SHARE;

        if (dCol !== 0) {
            const leadingCol = Math.floor(col + dCol + Math.sign(dCol) * edge);
            if (isClearAcross(leadingCol, row - edge, row + edge, home)) col += dCol;
            else heading = Math.PI - heading;
        }
        if (dRow !== 0) {
            const leadingRow = Math.floor(row + dRow + Math.sign(dRow) * edge);
            if (isClearAlong(leadingRow, col - edge, col + edge, home)) row += dRow;
            else heading = -heading;
        }
    }

    /** Whether every cell in column `cellCol` from row `fromRow` to `toRow` is in region `home`. */
    function isClearAcross(cellCol: number, fromRow: number, toRow: number, home: number): boolean {
        for (let r = Math.floor(fromRow); r <= Math.floor(toRow); r++) {
            if (regionAt(r, cellCol) !== home) return false;
        }
        return true;
    }

    /** Whether every cell in row `cellRow` from column `fromCol` to `toCol` is in region `home`. */
    function isClearAlong(cellRow: number, fromCol: number, toCol: number, home: number): boolean {
        for (let c = Math.floor(fromCol); c <= Math.floor(toCol); c++) {
            if (regionAt(cellRow, c) !== home) return false;
        }
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TURN_MIN_MS = 350;
const TURN_MAX_MS = 1300;
/** The most it turns at once, either way, in radians. */
const MAX_TURN = 1.3;
/**
 * How much of its radius bounces off fences. Less than all of it, so its
 * swirl brushes over a fence before it turns, and a wire strung close by
 * is in danger.
 */
const EDGE_SHARE = 0.6;
