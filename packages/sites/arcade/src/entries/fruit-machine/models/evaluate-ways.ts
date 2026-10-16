import type { Paytable, PictureKind, SymbolKind, WinLength } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One winning way: a path of one cell per reel, from the first reel across
 * three or more adjacent reels, every cell showing the same picture or the
 * wild.
 */
export interface WayWin {
    /** The picture the way pays for: always the one on the first reel. */
    readonly symbol: PictureKind;
    /** The row of each cell on the path, first reel first. Its length is the win's length, 3 to 5. */
    readonly rows: readonly number[];
    /** Credits the way pays. */
    readonly payout: number;
}

export interface EvaluateWaysOptions {
    /** The symbols showing, `window[reel][row]`. */
    readonly window: readonly (readonly SymbolKind[])[];
    readonly paytable: Paytable;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Every winning way in a window, highest payout first. Each way pays on its
 * own, so a picture on two rows of every reel of a five-reel win pays 32
 * times. A wild on the first reel starts no ways: the machine's strips have
 * none there, which is what makes a way's picture unambiguous.
 *
 * Called once per spin, not per frame, so it allocates freely.
 */
export function evaluateWays(options: EvaluateWaysOptions): WayWin[] {
    const { window, paytable } = options;
    const wins: WayWin[] = [];
    const seen = new Set<SymbolKind>();

    for (const symbol of window[0]) {
        if (symbol === 'wild' || seen.has(symbol)) continue;
        seen.add(symbol);

        // Every path of one picture spans the same reels: a reel either shows
        // the picture (or a wild) somewhere, which extends every path, or ends them all
        const matchingRows: number[][] = [];
        for (let reel = 0; reel < window.length; reel++) {
            const rows = rowsMatching(window[reel], symbol);
            if (rows.length === 0) break;
            matchingRows.push(rows);
        }

        const length = matchingRows.length;
        if (length < 3) continue;
        const payout = paytable[symbol][length as WinLength];
        for (const rows of pathsThrough(matchingRows)) {
            wins.push({ symbol, rows, payout });
        }
    }

    // Stable, so ways of equal payout keep the order of their first reel's picture, then their rows
    return wins.sort((a, b) => b.payout - a.payout);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function rowsMatching(reel: readonly SymbolKind[], symbol: PictureKind): number[] {
    const rows: number[] = [];
    for (let row = 0; row < reel.length; row++) {
        if (reel[row] === symbol || reel[row] === 'wild') rows.push(row);
    }
    return rows;
}

/** Every path that takes one of each reel's rows, top rows first. */
function pathsThrough(rowsByReel: readonly (readonly number[])[]): number[][] {
    let paths: number[][] = [[]];
    for (const rows of rowsByReel) {
        const longer: number[][] = [];
        for (const path of paths) {
            for (const row of rows) longer.push([...path, row]);
        }
        paths = longer;
    }
    return paths;
}
