// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a drag over the valley does to the edges it goes over: a stroke. The
 * first edge the player can change says whether it draws or rubs out. If
 * the river is drawn across that edge already, the stroke rubs the river
 * out from every edge it goes over. Otherwise it draws the river across
 * every edge it goes over. So going back over a reach just drawn leaves it,
 * and a drag can't flicker between drawing and rubbing out. Edges fixed by
 * a given are passed over, so a drag can start from a printed piece.
 *
 * Each stroke is undone as one. It begins with its first change, so a drag
 * that changes nothing leaves nothing to undo.
 */
export interface StrokeViewModel {
    /** The drag went over `edge`. */
    markOver: (edge: number) => void;
    /** The drag ended, so the next begins a stroke of its own. */
    finish: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the strokes are created with. */
export interface StrokeViewModelOptions {
    /** Whether the river is drawn across `edge`. */
    readonly isRiverAt: (edge: number) => boolean;
    /** Whether `edge` touches a given cell, so the player can't change it. */
    readonly isEdgeFixedAt: (edge: number) => boolean;
    /** The player began a stroke, with its first change to come. */
    readonly onStrokeStarted: () => void;
    /** The stroke drew the river across `edge`, or rubbed it out. */
    readonly onRiverSet: (edge: number, isRiver: boolean) => void;
    /** The player finished the stroke. */
    readonly onStrokeFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the strokes, with none being made. */
export function createStrokeViewModel(options: StrokeViewModelOptions): StrokeViewModel {
    const { isRiverAt, isEdgeFixedAt, onStrokeStarted, onRiverSet, onStrokeFinished } = options;
    // Whether the drag draws or rubs out, once its first edge says, and whether its stroke has begun
    let effect: StrokeEffect = 'undecided';
    let isStroking = false;

    return {
        markOver(edge) {
            if (isEdgeFixedAt(edge)) return;
            const isDrawn = isRiverAt(edge);
            if (effect === 'undecided') effect = isDrawn ? 'rub-out' : 'draw';
            if (effect === 'draw' && !isDrawn) setRiver(edge, true);
            else if (effect === 'rub-out' && isDrawn) setRiver(edge, false);
        },
        finish() {
            effect = 'undecided';
            if (isStroking) onStrokeFinished();
            isStroking = false;
        },
    };

    function setRiver(edge: number, isRiver: boolean): void {
        if (!isStroking) {
            isStroking = true;
            onStrokeStarted();
        }
        onRiverSet(edge, isRiver);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether a drag draws or rubs out: undecided until it goes over its first edge. */
type StrokeEffect = 'undecided' | 'draw' | 'rub-out';
