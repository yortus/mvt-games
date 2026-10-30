/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { BUTTON_HEIGHT, BUTTON_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    /** Where its left edge is. Its top is the row of buttons' top. */
    x: number;
    label: string;
    /** Whether what it chose is in force, which lights it. */
    isLit: () => boolean;
    onPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button in the row along the bottom of the screen, lit while what it chose is in force. */
export function ButtonView(bindings: ButtonViewBindings): Container {
    return (
        <container x={bindings.x} cursor="pointer" onPointerDown={bindings.onPressed}>
            <graphics
                ref={(g) => g.roundRect(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 6).fill(0xffffff)}
                tint={() => (bindings.isLit() ? LIT_COLOR : UNLIT_COLOR)}
            />
            <text text={bindings.label} x={BUTTON_WIDTH / 2} y={BUTTON_HEIGHT / 2} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LIT_COLOR = 0x2f81f7;
const UNLIT_COLOR = 0x30363d;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff };
