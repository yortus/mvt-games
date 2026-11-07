import type { EdgeMark } from '../models';
import type { DrawnMark } from './board-gestures-view-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a drag over the maze does to the edges it goes over: a stroke. The
 * first edge says whether it draws or rubs out. If that edge is already
 * marked with what the drag draws, the stroke rubs out that kind of mark
 * from every edge it goes over. Otherwise it draws on every edge it goes
 * over. So going back over a line just drawn leaves it, and a drag can't
 * flicker between drawing and rubbing out.
 *
 * Each stroke is undone as one. It begins with its first mark, so a drag
 * that changes nothing leaves nothing to undo.
 */
export interface StrokeViewModel {
    /** The drag went over `edge`, drawing `mark`. */
    markOver: (edge: number, mark: DrawnMark) => void;
    /** The drag ended, so the next begins a stroke of its own. */
    finish: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StrokeViewModelOptions {
    readonly markAt: (edge: number) => EdgeMark;
    /** The player began a stroke, with its first mark to come. */
    readonly onStrokeStarted: () => void;
    readonly onEdgeMarked: (edge: number, mark: EdgeMark) => void;
    readonly onStrokeFinished: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the strokes, with none being made. */
export function createStrokeViewModel(options: StrokeViewModelOptions): StrokeViewModel {
    const { markAt, onStrokeStarted, onEdgeMarked, onStrokeFinished } = options;
    // Whether the drag draws or rubs out, once its first edge says, and whether its stroke has begun
    let effect: StrokeEffect = 'undecided';
    let isStroking = false;

    return {
        markOver(edge, mark) {
            const isDrawn = markAt(edge) === mark;
            if (effect === 'undecided') effect = isDrawn ? 'rub-out' : 'draw';
            if (effect === 'draw' && !isDrawn) markEdge(edge, mark);
            else if (effect === 'rub-out' && isDrawn) markEdge(edge, 'unknown');
        },
        finish() {
            effect = 'undecided';
            if (isStroking) onStrokeFinished();
            isStroking = false;
        },
    };

    function markEdge(edge: number, mark: EdgeMark): void {
        if (!isStroking) {
            isStroking = true;
            onStrokeStarted();
        }
        onEdgeMarked(edge, mark);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether a drag draws or rubs out: undecided until it goes over its first edge. */
type StrokeEffect = 'undecided' | 'draw' | 'rub-out';
