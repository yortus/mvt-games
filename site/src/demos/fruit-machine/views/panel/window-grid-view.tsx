/** @jsxImportSource @mvtjs/html */
import type { SymbolKind } from '../../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WindowGridViewBindings {
    readonly reelCount: number;
    readonly rowCount: number;
    /** The symbol nearest each cell of the window, turning or not. */
    readonly symbolAt: (reel: number, row: number) => SymbolKind;
    readonly isLitAt: (reel: number, row: number) => boolean;
    readonly urlFor: (kind: SymbolKind) => string;
    readonly nameFor: (kind: SymbolKind) => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The window as a grid of small pictures, the cells being celebrated outlined. */
export function WindowGridView(bindings: WindowGridViewBindings): Element {
    const { reelCount, rowCount } = bindings;
    const cells: Element[] = [];
    for (let row = 0; row < rowCount; row++) {
        for (let reel = 0; reel < reelCount; reel++) cells.push(cell(bindings, reel, row));
    }

    return (
        <div class="window-grid" role="img" aria-label="The reels' window" style={`grid-template-columns: repeat(${reelCount}, 1fr)`}>
            {cells}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One cell of the grid. */
function cell(bindings: WindowGridViewBindings, reel: number, row: number): Element {
    return (
        <div class={() => (bindings.isLitAt(reel, row) ? 'cell lit' : 'cell')}>
            <img
                src={() => bindings.urlFor(bindings.symbolAt(reel, row))}
                alt={() => bindings.nameFor(bindings.symbolAt(reel, row))}
            />
        </div>
    );
}
