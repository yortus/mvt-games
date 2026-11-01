/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SwitchViewBindings {
    /** The switch's text, read once. */
    readonly label: string;
    /** Where the switch's top left corner is, read once. */
    readonly x: number;
    readonly y: number;
    readonly isOn: () => boolean;
    readonly onToggled?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A switch with a label, which slides its knob to show whether it's on. Both looks are drawn once. */
export function SwitchView(bindings: SwitchViewBindings): Container {
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            cursor="pointer"
            hitArea={new Rectangle(0, 0, 260, 32)}
            onPointerDown={() => bindings.onToggled?.()}
        >
            <graphics visible={() => !bindings.isOn()} ref={(g) => g.roundRect(0, 4, 48, 24, 12).fill(0x3a4560).circle(12, 16, 9).fill(0xc9d1d9)} />
            <graphics visible={bindings.isOn} ref={(g) => g.roundRect(0, 4, 48, 24, 12).fill(0x3fb37f).circle(36, 16, 9).fill(0xffffff)} />
            <text text={bindings.label} x={60} y={16} anchorY={0.5} style={LABEL_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 15, fill: 0xe6edf3 };
