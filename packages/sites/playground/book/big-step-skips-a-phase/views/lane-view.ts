import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { BoardPhase, CellKind } from '../models';
import { BoardView } from './board-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LaneViewBindings {
    /** How this lane's board is moved on, as a heading. */
    readonly title: string;
    /** The test code this lane's way of moving time matches. */
    readonly note: string;
    readonly rows: number;
    readonly cols: number;
    readonly kindAt: (row: number, col: number) => CellKind;
    readonly cactusRowAt: (row: number, col: number) => number;
    readonly cactusColAt: (row: number, col: number) => number;
    readonly phase: () => BoardPhase;
    /** Whether the run has finished, so the test's check shows its result. */
    readonly isChecked: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One board, with a heading above it, and below it the board's phase and,
 * once the run has finished, whether the test's check passes. The view is
 * centred on x = 0.
 */
export function LaneView(bindings: LaneViewBindings): Container {
    const { rows, cols, phase, isChecked } = bindings;
    const view = new Container();

    const title = new Text({ text: bindings.title, style: { ...TEXT_STYLE, fontSize: 18, fill: 0xffffff } });
    title.anchor.set(0.5, 0);
    title.y = 20;
    const note = new Text({ text: bindings.note, style: { ...TEXT_STYLE, fill: 0x7f8f7f } });
    note.anchor.set(0.5, 0);
    note.y = 48;

    const board = BoardView({
        rows,
        cols,
        cellSize: CELL_SIZE,
        kindAt: bindings.kindAt,
        cactusRowAt: bindings.cactusRowAt,
        cactusColAt: bindings.cactusColAt,
    });
    board.position.set(-cols * CELL_SIZE / 2, 80);

    const boardBottom = 80 + rows * CELL_SIZE;
    const phaseText = new Text({ text: '', style: TEXT_STYLE });
    phaseText.anchor.set(0.5, 0);
    phaseText.y = boardBottom + 16;
    const passText = new Text({ text: 'PASS', style: { ...TEXT_STYLE, fontSize: 18, fill: 0x66dd77 } });
    passText.anchor.set(0.5, 0);
    passText.y = boardBottom + 44;
    const failText = new Text({ text: "FAIL: expected 'idle'", style: { ...TEXT_STYLE, fontSize: 18, fill: 0xff5566 } });
    failText.anchor.set(0.5, 0);
    failText.y = boardBottom + 44;

    view.addChild(title, note, board, phaseText, passText, failText);

    // The text is made again only when the phase changes
    const phaseLabel = createComputed({ watch: phase, compute: (p) => `board.phase is '${p}'` });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        phaseText.text = phaseLabel();
        // The test's check: expect(board.phase).toBe('idle')
        const isPassing = phase() === 'idle';
        const isShown = isChecked();
        passText.visible = isShown && isPassing;
        failText.visible = isShown && !isPassing;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The width and height of one cell, in pixels. */
const CELL_SIZE = 52;

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0xd8e8d8 };
