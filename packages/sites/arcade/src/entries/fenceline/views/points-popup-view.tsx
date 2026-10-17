/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { memoiseLast, watch } from '@mvtjs/utils';
import { PixelTextView } from '#shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PointsPopupViewBindings {
    /** Wires tied off so far. Each rise shows the points the wire scored. */
    closureCount: () => number;
    /** The points the latest wire scored. */
    points: () => number;
    /** The middle of the pasture the latest wire fenced off, in cells. */
    row: () => number;
    col: () => number;
    /** A cell's size in pixels, read once. */
    cellSize: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The points a wire scored, floating up from the middle of the new pasture
 * and fading as each wire is tied off.
 */
export function PointsPopupView(bindings: PointsPopupViewBindings): Container {
    const { cellSize } = bindings;
    const watcher = watch({ closures: bindings.closureCount });
    watcher.poll();
    const pointsText = memoiseLast((points: number) => `+${points}`);

    // Presentation state: the points shown, where, and for how long so far
    let shownPoints = 0;
    let x = 0;
    let y = 0;
    let ageMs = SHOW_MS;

    return (
        <container
            visible={() => ageMs < SHOW_MS}
            x={() => x}
            y={() => Math.round(y - ageMs * RISE_PER_MS)}
            alpha={() => Math.min(1, 2 * (1 - ageMs / SHOW_MS))}
            onUpdate={update}
        >
            <PixelTextView text={() => pointsText(shownPoints)} color={0xffffff} outline={OUTLINE_COLOR} anchorX={0.5} anchorY={0.5} />
        </container>
    );

    function update(deltaMs: number): void {
        ageMs += deltaMs;
        if (!watcher.poll().closures.increased || bindings.points() === 0) return;
        shownPoints = bindings.points();
        x = Math.round(bindings.col() * cellSize);
        y = Math.round(bindings.row() * cellSize);
        ageMs = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHOW_MS = 1300;
const RISE_PER_MS = 0.015;

/** The outline round the points, in the pixel glyphs at their own size. */
const OUTLINE_COLOR = 0x24180d;
