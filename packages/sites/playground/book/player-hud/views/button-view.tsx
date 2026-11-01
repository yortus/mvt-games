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
    /** Whether the button can be pressed. A disabled button is greyed out, and ignores presses. Enabled if left out. */
    readonly isEnabled?: () => boolean;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button, drawn once, and greyed out while it's disabled. */
export function ButtonView(bindings: ButtonViewBindings): Container {
    const isEnabled = bindings.isEnabled ?? isAlwaysEnabled;
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            alpha={() => (isEnabled() ? 1 : 0.35)}
            cursor={() => (isEnabled() ? 'pointer' : 'default')}
            hitArea={new Rectangle(0, 0, WIDTH, HEIGHT)}
            onPointerDown={() => {
                if (isEnabled()) bindings.onPressed?.();
            }}
        >
            <graphics ref={(g) => g.roundRect(0, 0, WIDTH, HEIGHT, 8).fill(0x2a3550).stroke({ color: 0x5a6a90, width: 2 })} />
            <text text={bindings.label} x={WIDTH / 2} y={HEIGHT / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WIDTH = 120;
const HEIGHT = 36;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0xe6edf3 };

function isAlwaysEnabled(): boolean {
    return true;
}
