import { createScopeModel, type ScopeModel } from './scope-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The demo's top-level model, which the entry creates and the top-level view
 * reads. All it holds is the scope, where the demo's state and rules live.
 */
export interface DemoModel {
    /** The fractalscope, and the fractal under it. */
    readonly scope: ScopeModel;
    /** Moves the scope on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the demo, with the scope at its rest setting. */
export function createDemoModel(): DemoModel {
    const scope = createScopeModel();

    return {
        scope,
        update(deltaMs) {
            scope.update(deltaMs);
        },
    };
}
