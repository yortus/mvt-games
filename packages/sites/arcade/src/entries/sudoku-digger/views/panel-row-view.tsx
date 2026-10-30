/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { DIM_TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PanelRowViewBindings {
    /** What the row shows, on its left. Read once. */
    label: string;
    /** Its value, on its right. Made only when it changes, so it costs nothing to read each frame. */
    value: () => string;
    /** The value's colour. */
    color: () => number;
    /** How wide the row is, from its label's left to its value's right, in pixels. Read once. */
    width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A label and its value, across one line of the panel. */
export function PanelRowView(bindings: PanelRowViewBindings): Container {
    return (
        <container>
            <text text={bindings.label} style={LABEL_STYLE} tint={DIM_TEXT_COLOR} />
            <text x={bindings.width} anchorX={1} text={bindings.value} style={VALUE_STYLE} tint={bindings.color} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0xffffff };
const VALUE_STYLE = { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', fill: 0xffffff };
