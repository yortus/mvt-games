/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How wide a card is, in pixels. */
const CARD_W = 110;
/** How tall a card is, in pixels. */
const CARD_H = 150;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardViewBindings {
    /** Where the card's middle is, read once. */
    readonly x: number;
    readonly y: number;
    readonly color: () => number;
    /** The name on the card, read once. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A card, with its face drawn in its colour, and a label. Redrawing a
 * `Graphics` is costly, so the face is drawn in an `onRefresh` step that
 * redraws it only when the colour changes. Most frames, the step reads the
 * colour, sees it's the one already drawn, and stops.
 */
export function CardView(bindings: CardViewBindings): Container {
    let drawnColor = -1; // the colour the face was last drawn in

    return (
        <container x={bindings.x} y={bindings.y}>
            <graphics onRefresh={redrawFaceWhenColorChanges} />
            <text text={bindings.label} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );

    function redrawFaceWhenColorChanges(g: Graphics): void {
        const color = bindings.color();
        if (color === drawnColor) return;
        drawnColor = color;
        g.clear().roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10)
            .fill(color);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: 0x1a1a1a } as const;
