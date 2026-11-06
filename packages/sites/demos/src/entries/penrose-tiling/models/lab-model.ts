import { createScopeModel, type ScopeModel } from './scope-model';
import { createTilingModel, type TilingModel } from './tiling-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The lab: a tiling, and the scope looking at it. Neither knows about the
 * other. Each tick, the lab moves both on, then tells the tiling where the
 * scope is looking, so that the tiles are always there to be seen.
 */
export interface LabModel {
    /** What's under the scope. */
    readonly tiling: TilingModel;
    /** What's looking at it. */
    readonly scope: ScopeModel;
    /** Moves the tiling and the scope on by `deltaMs`, and lays the tiles again if they need it. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link LabModel}. */
export interface LabModelOptions {
    /**
     * Seed for the random numbers that pick a random tiling. Pass one for
     * tilings that come out the same each time; defaults to a random seed.
     */
    readonly seed?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a lab with the scope at the middle of the Penrose tiling, and the tiles it sees already laid. */
export function createLabModel(options: LabModelOptions): LabModel {
    const tiling = createTilingModel(options);
    const scope = createScopeModel();
    layTilesUnderScope();

    return {
        get tiling() { return tiling; },
        get scope() { return scope; },
        update(deltaMs) {
            tiling.update(deltaMs);
            scope.update(deltaMs);
            layTilesUnderScope();
        },
    };

    function layTilesUnderScope(): void {
        tiling.layTilesOver(scope.centreX, scope.centreY, scope.radius);
    }
}
