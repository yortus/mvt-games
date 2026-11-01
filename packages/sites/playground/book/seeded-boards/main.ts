import { Text } from 'pixi.js';
import { definePixiProject } from 'playground';
import { createBoardModel, createSeededRandom, type Random } from './models';
import { BoardView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many rows each board has. */
const ROWS = 5;
/** How many columns each board has. */
const COLS = 5;
/** The width and height of one cell, in pixels. */
const CELL_SIZE = 36;

/**
 * Three boards, each dealt from the random source beside its title. Press
 * Restart: the two seeded boards deal the same cactii every time, and the
 * one dealt from Math.random deals new ones. Try another seed, too.
 */
const DEALS: readonly { readonly title: string; readonly random: () => Random }[] = [
    { title: 'createSeededRandom\n({ seed: 7 })', random: () => createSeededRandom({ seed: 7 }) },
    { title: 'createSeededRandom\n({ seed: 7 })', random: () => createSeededRandom({ seed: 7 }) },
    { title: 'Math.random', random: () => Math.random },
];

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// The project: three boards, each made as a visual test would make it, and
// a view of each. Nothing moves, so there's nothing to tick.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0f1a12,
    start: ({ stage }) => {
        const boardWidth = COLS * CELL_SIZE;
        const gap = (WIDTH - DEALS.length * boardWidth) / (DEALS.length + 1);
        for (let i = 0; i < DEALS.length; i++) {
            const left = gap + i * (boardWidth + gap);
            const board = createBoardModel({ rows: ROWS, cols: COLS, random: DEALS[i].random() });

            const title = new Text({
                text: DEALS[i].title,
                style: { fontFamily: 'monospace', fontSize: 13, fill: 0xd8e8d8, align: 'center', lineHeight: 18 },
            });
            title.anchor.set(0.5, 1);
            title.position.set(left + boardWidth / 2, 100);

            const view = BoardView({ rows: board.rows, cols: board.cols, cellSize: CELL_SIZE, kindAt: board.kindAt });
            view.position.set(left, 114);
            stage.addChild(title, view);
        }
    },
});
