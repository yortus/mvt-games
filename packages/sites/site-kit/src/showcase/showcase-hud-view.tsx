/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShowcaseHudViewBindings {
    /** The showcase's view, in pixels. Its width may change, for a showcase that fits itself to the page. */
    readonly width: ValueOrGetter<number>;
    readonly height: number;
    /** The help to show along the bottom of the view. An empty string hides it. */
    readonly hint: () => string;
    /** A line in the top corner, such as how many halls deep the visitor is. An empty string hides it. */
    readonly cornerLine: () => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A line of help over a showcase, such as how to play the entry in reach, and a line in the corner. */
export function ShowcaseHudView({ width, height, hint, cornerLine }: ShowcaseHudViewBindings): Container {
    const middle = typeof width === 'function' ? () => width() / 2 : width / 2;
    return (
        <container>
            <text text={hint} x={middle} y={height - 28} anchorX={0.5} anchorY={1} style={STYLE} />
            <text text={cornerLine} x={16} y={12} style={CORNER_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STYLE = {
    fill: 0xffffff,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 22,
    fontWeight: '700',
    stroke: { color: 0x000000, width: 5 },
    align: 'center',
} as const;
const CORNER_STYLE = { ...STYLE, fontSize: 18, fill: 0xdcdce8, stroke: { color: 0x000000, width: 4 } } as const;
