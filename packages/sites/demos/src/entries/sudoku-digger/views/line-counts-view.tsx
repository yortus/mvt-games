/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { CELL_SIZE, DIM_TEXT_COLOR, NUMBER_TEXTS, WARNING_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LineCountsViewBindings {
    /** Whether the counts show. They mean something only once digging starts. */
    isShown: () => boolean;
    /** How many givens each row and each column holds, from 0 to 8. */
    givensInRow: (row: number) => number;
    givensInColumn: (column: number) => number;
    /** The fewest givens a line may keep. A line at this many can spare no more, and its count turns red. */
    fewestPerLine: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * How many givens each row and each column holds: a number to the left of
 * each row, and one above each column. Its origin is the grid's top left
 * corner, so the numbers sit just outside it.
 */
export function LineCountsView(bindings: LineCountsViewBindings): Container {
    const rows: Container[] = [];
    const columns: Container[] = [];
    for (let i = 0; i < 9; i++) {
        rows.push(<CountView count={() => bindings.givensInRow(i)} fewest={bindings.fewestPerLine} x={-GAP} y={(i + 0.5) * CELL_SIZE} />);
        columns.push(<CountView count={() => bindings.givensInColumn(i)} fewest={bindings.fewestPerLine} x={(i + 0.5) * CELL_SIZE} y={-GAP} />);
    }
    return (
        <container label="line-counts" visible={bindings.isShown}>
            {rows}
            {columns}
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the numbers are from the grid's edge, to their middles, in pixels. */
const GAP = 13;

const COUNT_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0xffffff };

interface CountViewBindings {
    count: () => number;
    fewest: () => number;
    /** Where its middle is. */
    x: number;
    y: number;
}

/** One line's count, red when the line is at its fewest. */
function CountView(bindings: CountViewBindings): Container {
    return (
        <text
            x={bindings.x}
            y={bindings.y}
            anchor={0.5}
            style={COUNT_STYLE}
            text={() => NUMBER_TEXTS[bindings.count()]}
            tint={() => (bindings.count() <= bindings.fewest() ? WARNING_COLOR : DIM_TEXT_COLOR)}
        />
    );
}
