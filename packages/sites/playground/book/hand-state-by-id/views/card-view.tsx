/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardViewBindings {
    readonly label: () => string;
    readonly color: () => number;
    /** Where the card's middle is now, in pixels. */
    readonly x: () => number;
    readonly alpha: () => number;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One card. It keeps no state of its own: where it is and how faded come
 * from its bindings, so the slot it sits in can change card freely.
 */
export function CardView(bindings: CardViewBindings): Container {
    return (
        <container
            x={bindings.x}
            alpha={bindings.alpha}
            pivotX={CARD_W / 2}
            pivotY={CARD_H / 2}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, CARD_W, CARD_H)}
            onPointerDown={() => bindings.onPressed?.()}
        >
            {/* The face is drawn white once, and tinted with the card's colour */}
            <graphics tint={bindings.color} ref={(g) => g.roundRect(0, 0, CARD_W, CARD_H, 10).fill(0xffffff)} />
            <text text={bindings.label} x={CARD_W / 2} y={CARD_H / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_W = 64;
const CARD_H = 88;

const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff };
