import { Container } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { createReaction, createSequence } from '@mvtjs/utils';
import type { BoardPhase, Cell, GemKind } from '../models';
import { CelebrationView } from './celebration-view';
import { FlashOverlayView } from './flash-overlay-view';
import { GemsView } from './gems-view';
import { MATCH_STEPS } from './match-steps';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    /** The board's size, read once. */
    readonly rows: number;
    readonly cols: number;
    readonly phase: () => BoardPhase;
    readonly gemAt: (row: number, col: number) => GemKind;
    readonly matchedCells: () => readonly Cell[];
    readonly points: () => number;
    readonly onCellPressed?: (row: number, col: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The board, and the celebration as a match is made. This view makes the
 * match sequence, starts it as the board's phase becomes `'matching'`, and
 * moves it on in its update step. Its children share the sequence, and each
 * reads only the steps it cares about. None of them knows about the others.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const { rows, cols } = bindings;
    const matchSequence = createSequence(MATCH_STEPS);

    const view = new Container();
    view.addChild(
        GemsView({ matchSequence, rows, cols, gemAt: bindings.gemAt, onCellPressed: bindings.onCellPressed }),
        FlashOverlayView({ matchSequence, rows, cols }),
        CelebrationView({ matchSequence, matchedCells: bindings.matchedCells, points: bindings.points }),
    );

    const startCelebrationWhenMatching = createReaction({
        watch: bindings.phase,
        when: 'matching',
        react: () => matchSequence.start(),
    });

    setUpdate(view, (deltaMs) => {
        startCelebrationWhenMatching();
        matchSequence.update(deltaMs);
    });
    return view;
}
