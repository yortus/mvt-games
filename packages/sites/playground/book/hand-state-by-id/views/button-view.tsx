/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    /** The button's text, read once. */
    readonly label: string;
    /** Where the button's top left corner is, read once. */
    readonly x: number;
    readonly y: number;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button, drawn once. */
export function ButtonView(bindings: ButtonViewBindings): Container {
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, WIDTH, HEIGHT)}
            onPointerDown={() => bindings.onPressed?.()}
        >
            <graphics ref={(g) => g.roundRect(0, 0, WIDTH, HEIGHT, 8).fill(0x2a3550).stroke({ color: 0x5a6a90, width: 2 })} />
            <text text={bindings.label} x={WIDTH / 2} y={HEIGHT / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WIDTH = 96;
const HEIGHT = 36;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0xe6edf3 };
