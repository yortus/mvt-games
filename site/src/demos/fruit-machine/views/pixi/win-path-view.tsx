/** @jsxImportSource @mvtjs/pixi */
import type { Container, Graphics } from 'pixi.js';
import { ROW_COUNT } from '../../data';
import { CELL_SIZE, cellCenterX, cellCenterY, DIM, REEL_COUNT, REEL_GAP, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WinPathViewBindings {
    readonly isCelebrating: () => boolean;
    readonly isLitAt: (reel: number, row: number) => boolean;
    /** The rows of the way being shown, first reel first; undefined during the opener. */
    readonly pathRows: () => readonly number[] | undefined;
    /** The colour of the way's fruit. */
    readonly pathColor: () => number;
    /** How far through the current step, from 0 to 1. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows off the celebration's current step over the reels: the cells on the
 * way pulse in gold frames, a line in the fruit's colour joins them, and
 * every other cell dims. A function of the step and its progress, so no state.
 */
export function WinPathView(bindings: WinPathViewBindings): Container {
    let drawnRows: readonly number[] | undefined;
    const cells: { reel: number; row: number }[] = [];
    for (let reel = 0; reel < REEL_COUNT; reel++) {
        for (let row = 0; row < ROW_COUNT; row++) cells.push({ reel, row });
    }

    return (
        <container visible={bindings.isCelebrating}>
            {cells.map(({ reel, row }) => (
                <graphics
                    x={cellCenterX(reel)}
                    y={cellCenterY(row)}
                    alpha={0.6}
                    ref={drawDimmer}
                    visible={() => !bindings.isLitAt(reel, row)}
                />
            ))}
            <graphics onRefresh={redrawPath} />
            {cells.map(({ reel, row }) => (
                <graphics
                    x={cellCenterX(reel)}
                    y={cellCenterY(row)}
                    ref={drawFrame}
                    visible={() => bindings.isLitAt(reel, row)}
                    scale={() => 1 + PULSE * Math.sin(bindings.progress() * Math.PI * 2)}
                />
            ))}
        </container>
    );

    /** Redrawn only when the step shows a different way. */
    function redrawPath(g: Graphics): void {
        const rows = bindings.pathRows();
        if (rows === drawnRows) return;
        drawnRows = rows;
        g.clear();
        if (rows === undefined) return;
        g.moveTo(cellCenterX(0), cellCenterY(rows[0]));
        for (let reel = 1; reel < rows.length; reel++) g.lineTo(cellCenterX(reel), cellCenterY(rows[reel]));
        g.stroke({ width: 16, color: WHITE, cap: 'round', join: 'round' });
        g.moveTo(cellCenterX(0), cellCenterY(rows[0]));
        for (let reel = 1; reel < rows.length; reel++) g.lineTo(cellCenterX(reel), cellCenterY(rows[reel]));
        g.stroke({ width: 8, color: bindings.pathColor(), cap: 'round', join: 'round' });
        for (let reel = 0; reel < rows.length; reel++) {
            g.circle(cellCenterX(reel), cellCenterY(rows[reel]), 9).fill(WHITE);
            g.circle(cellCenterX(reel), cellCenterY(rows[reel]), 5).fill(bindings.pathColor());
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much a lit cell's frame swells, at the height of each pulse. */
const PULSE = 0.05;
/** Gold, to stand out on the cream reels. */
const FRAME_GOLD = 0xffc233;

function drawDimmer(g: Graphics): void {
    // As wide as a cell and the gap beside it, so neighbouring dimmers meet
    const width = CELL_SIZE + REEL_GAP;
    g.rect(-width / 2, -CELL_SIZE / 2, width, CELL_SIZE).fill(DIM);
}

function drawFrame(g: Graphics): void {
    const half = CELL_SIZE / 2 - 4;
    g.roundRect(-half, -half, half * 2, half * 2, 14).stroke({ width: 7, color: FRAME_GOLD });
}
