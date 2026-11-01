import { Container, Graphics, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LegendViewBindings {
    /** What the rings show. Read once. */
    readonly text: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A ring, as the cannons' rows draw them, and what it means. The view's origin is the ring's centre. */
export function LegendView(bindings: LegendViewBindings): Container {
    const view = new Container();
    const ring = new Graphics().circle(0, 0, 11).stroke({ color: 0x8899aa, width: 2, alpha: 0.6 });
    const text = new Text({
        text: bindings.text,
        style: { fontFamily: 'monospace', fontSize: 15, fill: 0x8899aa },
    });
    text.anchor.set(0, 0.5);
    text.x = 20;
    view.addChild(ring, text);
    return view;
}
