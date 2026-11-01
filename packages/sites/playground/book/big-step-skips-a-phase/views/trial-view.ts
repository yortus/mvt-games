import { Container, Text } from 'pixi.js';
import type { BoardModel, SwapTrialModel } from '../models';
import { LaneView } from './lane-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TrialViewBindings {
    readonly model: SwapTrialModel;
    /** The width of the play area, in pixels. */
    readonly width: number;
    /** The height of the play area, in pixels. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The trial's two boards side by side: on the left the one moved on a frame
 * at a time, and on the right the one moved on in big steps. A line at the
 * foot says what each run does.
 */
export function TrialView({ model, width, height }: TrialViewBindings): Container {
    const view = new Container();
    const isChecked = (): boolean => model.phase === 'asserting';

    const frameLane = LaneView({
        title: 'A frame at a time',
        note: 'as advanceTime does',
        ...laneBindings(() => model.frameBoard),
        isChecked,
    });
    frameLane.x = width / 4;

    const bigStepLane = LaneView({
        title: `Steps of ${model.bigStepMs} ms`,
        note: `as board.update(${model.bigStepMs}) does`,
        ...laneBindings(() => model.bigStepBoard),
        isChecked,
    });
    bigStepLane.x = width * 3 / 4;

    const footer = new Text({
        text: "Each run swaps two cactii that don't match, and moves time on by three swaps.",
        style: { fontFamily: 'monospace', fontSize: 12, fill: 0x7f8f7f },
    });
    footer.anchor.set(0.5, 1);
    footer.position.set(width / 2, height - 10);

    view.addChild(frameLane, bigStepLane, footer);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The bindings a lane needs from its board. The trial makes new boards for
 * each run, so each binding asks for the board afresh.
 */
function laneBindings(board: () => BoardModel) {
    const first = board();
    return {
        rows: first.rows,
        cols: first.cols,
        kindAt: (row: number, col: number) => board().cells[row][col].kind,
        cactusRowAt: (row: number, col: number) => board().cells[row][col].cactusRow,
        cactusColAt: (row: number, col: number) => board().cells[row][col].cactusCol,
        phase: () => board().phase,
    };
}
