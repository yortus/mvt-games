import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PositionViewBindings {
    /** The row, in tiles. */
    readonly row: () => number;
    /** The column, in tiles. */
    readonly col: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The row and the column, as numbers with two decimal places, just as the model gives them. */
export function PositionView(bindings: PositionViewBindings): Container {
    const view = new Container();
    const text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xe0e8f0 },
    });
    view.addChild(text);

    // The text is made again only when a hundredth changes, not every frame
    const label = createComputed({
        watch: {
            row: () => Math.round(bindings.row() * 100),
            col: () => Math.round(bindings.col() * 100),
        },
        compute: formatPosition,
    });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        text.text = label();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The row and the column, from hundredths of a tile, such as `row 3.00   col 4.25`. */
function formatPosition({ row, col }: { readonly row: number; readonly col: number }): string {
    return `row ${(row / 100).toFixed(2)}   col ${(col / 100).toFixed(2)}`;
}
