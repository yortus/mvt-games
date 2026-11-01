/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { BoardModel } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: BoardModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The board, and a hint above it. */
export function GameView({ model }: GameViewBindings): Container {
    return (
        <container>
            <text text="Click gems quickly, one after another, to make a chain." x={320} y={18} anchor={0.5} style={HINT_STYLE} />
            <BoardView
                rows={model.rows}
                cols={model.cols}
                gemAt={model.gemAt}
                matchedCells={() => model.matchedCells}
                points={() => model.points}
                cascadeStep={() => model.cascadeStep}
                onCellPressed={model.matchAt}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
