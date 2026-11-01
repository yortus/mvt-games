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
            <text text="Click a gem to match it with its neighbours." x={320} y={50} anchor={0.5} style={HINT_STYLE} />
            <BoardView
                rows={model.rows}
                cols={model.cols}
                phase={() => model.phase}
                gemAt={model.gemAt}
                matchedCells={() => model.matchedCells}
                points={() => model.points}
                onCellPressed={model.matchAt}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 15, fill: 0x8b949e };
