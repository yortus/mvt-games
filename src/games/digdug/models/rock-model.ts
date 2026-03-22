import gsap from 'gsap';
import type { RockPhase } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RockModel {
    readonly row: number;
    readonly col: number;
    /** Smooth column position (fractional while falling). */
    readonly smoothCol: number;
    /** Smooth row position (fractional while falling). */
    readonly smoothRow: number;
    readonly phase: RockPhase;
    /** 0..1 progress within the current phase. */
    readonly progress: number;
    readonly isAlive: boolean;
    /** Mark as destabilized (dirt below removed). */
    destabilize(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RockModelOptions {
    row: number;
    col: number;
    /** Max rows in the field (for bounds checking). */
    fieldRows: number;
    /** Check if a tile is empty enough for the rock to fall through. */
    isWalkable: (row: number, col: number) => boolean;
    /** Tiles per second when falling. */
    fallSpeed?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const WOBBLE_SECONDS = 0.5;
const SHATTER_SECONDS = 0.8;

export function createRockModel(options: RockModelOptions): RockModel {
    const { row: initRow, col: initCol, fieldRows, isWalkable, fallSpeed = 8 } = options;

    const state: {
        row: number;
        col: number;
        smoothCol: number;
        smoothRow: number;
        phase: RockPhase;
        progress: number;
        alive: boolean;
    } = {
        row: initRow,
        col: initCol,
        smoothCol: initCol,
        smoothRow: initRow,
        phase: 'stable',
        progress: 0,
        alive: true,
    };

    const timeline = gsap.timeline({ paused: true });

    // ---- Public record -----------------------------------------------------

    const model: RockModel = {
        get row() {
            return state.row;
        },
        get col() {
            return state.col;
        },
        get smoothCol() {
            return state.smoothCol;
        },
        get smoothRow() {
            return state.smoothRow;
        },
        get phase() {
            return state.phase;
        },
        get progress() {
            return state.progress;
        },
        get isAlive() {
            return state.alive;
        },

        destabilize(): void {
            if (state.phase !== 'stable') return;
            timeline.clear().time(0);
            scheduleWobble();
        },

        update(deltaMs: number): void {
            if (!state.alive) return;
            timeline.time(timeline.time() + 0.001 * deltaMs);
        },
    };

    return model;

    // ---- Schedule helpers --------------------------------------------------

    function scheduleWobble(): void {
        state.phase = 'wobbling';
        state.progress = 0;

        const t = timeline.time();
        timeline.to(state, { progress: 1, duration: WOBBLE_SECONDS, ease: 'none' }, t);
        timeline.call(scheduleFall, undefined, t + WOBBLE_SECONDS);
    }

    function scheduleFall(): void {
        state.progress = 0;
        const startRow = state.row;
        let endRow = startRow;

        // Determine how many rows the rock can fall through
        while (endRow + 1 < fieldRows && isWalkable(endRow + 1, state.col)) {
            endRow++;
        }

        if (endRow === startRow) {
            // Nowhere to fall - shatter immediately
            scheduleShatter();
            return;
        }

        state.phase = 'falling';
        const distance = endRow - startRow;
        const duration = distance / fallSpeed;

        const t = timeline.time();
        timeline.to(state, { smoothRow: endRow, duration, ease: 'power1.in' }, t);
        timeline.to(state, { progress: 1, duration, ease: 'none' }, t);
        timeline.call(
            () => {
                state.row = endRow;
            },
            undefined,
            t + duration,
        );
        timeline.call(scheduleShatter, undefined, t + duration);
    }

    function scheduleShatter(): void {
        state.phase = 'shattered';
        state.progress = 0;

        const t = timeline.time();
        timeline.to(state, { progress: 1, duration: SHATTER_SECONDS, ease: 'none' }, t);
        timeline.call(
            () => {
                state.alive = false;
            },
            undefined,
            t + SHATTER_SECONDS,
        );
    }
}
