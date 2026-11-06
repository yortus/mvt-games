import { createDiggerModel, type DiggerModel } from '@mvtjs/puzzles/sudoku-generator/models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. All it holds is the digger, the model that the Sudoku puzzle makes
 * its puzzles with, which this demo shows at work.
 */
export interface DemoModel {
    /** The digger, making one puzzle after another. */
    readonly digger: DiggerModel;
    /** Moves the digger on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoModelOptions {
    /** The seed for the digger's random numbers. The same seed makes the same puzzles. */
    readonly seed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the demo, with a digger that starts its first puzzle at the first update. */
export function createDemoModel(options: DemoModelOptions): DemoModel {
    const digger = createDiggerModel(options);

    return {
        digger,
        update(deltaMs) {
            digger.update(deltaMs);
        },
    };
}
