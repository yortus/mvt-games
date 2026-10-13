/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { memoiseLast, watch } from '@mvtjs/utils';
import { HUD_FONT } from './view-constants';

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
        <text
            text={() => pointsText(shownPoints)}
            anchor={0.5}
            style={STYLE}
            visible={() => ageMs < SHOW_MS}
            x={() => x}
            y={() => Math.round(y - ageMs * RISE_PER_MS)}
            alpha={() => Math.min(1, 2 * (1 - ageMs / SHOW_MS))}
            onUpdate={update}
        />
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

const STYLE = {
    fontFamily: HUD_FONT,
    fontSize: 12,
    fontWeight: 'bold',
    fill: 0xffffff,
    stroke: { color: 0x24180d, width: 3 },
} as const;
