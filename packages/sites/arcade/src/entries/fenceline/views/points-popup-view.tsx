/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed, createReaction, increased } from '@mvtjs/utils';
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
    // Presentation state: the points shown, where, and for how long so far
    let shownPoints = 0;
    let x = 0;
    let y = 0;
    let ageMs = SHOW_MS;
    const pointsText = createComputed({ watch: () => shownPoints, compute: (points) => `+${points}` });
    // The points show as each wire is tied off, if it scored
    const showPointsPopupWhenFenceCloses = createReaction({
        watch: bindings.closureCount,
        when: increased,
        react: () => {
            if (bindings.points() === 0) return;
            shownPoints = bindings.points();
            x = Math.round(bindings.col() * cellSize);
            y = Math.round(bindings.row() * cellSize);
            ageMs = 0;
        },
    });

    return (
        <container
            visible={() => ageMs < SHOW_MS}
            x={() => x}
            y={() => Math.round(y - ageMs * RISE_PER_MS)}
            alpha={() => Math.min(1, 2 * (1 - ageMs / SHOW_MS))}
            onUpdate={update}
        >
            <PixelTextView text={pointsText} color={0xffffff} outline={OUTLINE_COLOR} anchorX={0.5} anchorY={0.5} />
        </container>
    );

    function update(deltaMs: number): void {
        ageMs += deltaMs;
        showPointsPopupWhenFenceCloses();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHOW_MS = 1300;
const RISE_PER_MS = 0.015;

/** The outline round the points, in the pixel glyphs at their own size. */
const OUTLINE_COLOR = 0x24180d;
