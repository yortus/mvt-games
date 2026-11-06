import { createFruitMachineModel, type FruitMachineModel, type FruitMachineModelOptions } from './fruit-machine-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. All it holds is the machine, which every view reads and any view
 * may act on.
 */
export interface DemoModel {
    /** The fruit machine. */
    readonly machine: FruitMachineModel;
    /** Moves the machine on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type DemoModelOptions = FruitMachineModelOptions;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the demo, with the machine idle. */
export function createDemoModel(options: DemoModelOptions): DemoModel {
    const machine = createFruitMachineModel(options);

    return {
        machine,
        update(deltaMs) {
            machine.update(deltaMs);
        },
    };
}
