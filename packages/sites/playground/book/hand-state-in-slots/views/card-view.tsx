/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How quickly the card eases, in ms. Smaller is quicker. */
const SMOOTH_MS = 120;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardViewBindings {
    readonly label: () => string;
    readonly color: () => number;
    /** Where the card's middle belongs in the row, read once. */
    readonly targetX: number;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One card, which eases its own `x` toward its place in the row, and fades
 * itself in as it's built. This state is kept here, in the view, and in a
 * `<List>` this view belongs to a slot, not to a card. That's the mistake
 * this example shows: when the cards move between slots, the state stays
 * behind with the slot.
 */
export function CardView(bindings: CardViewBindings): Container {
    // The card's presentation state, which starts valid: in its place, and transparent
    let x = bindings.targetX;
    let alpha = 0;

    return (
        <container
            x={() => x}
            y={0}
            alpha={() => alpha}
            pivotX={CARD_W / 2}
            pivotY={CARD_H / 2}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, CARD_W, CARD_H)}
            onPointerDown={() => bindings.onPressed?.()}
            onUpdate={update}
        >
            {/* The face is drawn white once, and tinted with the card's colour */}
            <graphics tint={bindings.color} ref={(g) => g.roundRect(0, 0, CARD_W, CARD_H, 10).fill(0xffffff)} />
            <text text={bindings.label} x={CARD_W / 2} y={CARD_H / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );

    function update(deltaMs: number): void {
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
        x += (bindings.targetX - x) * ease;
        alpha += (1 - alpha) * ease;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_W = 64;
const CARD_H = 88;

const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff };
