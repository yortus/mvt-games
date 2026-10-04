import { PICTURE_KINDS, type Paytable, type PictureKind, type SymbolKind, type WinLength } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a machine pays back, on average, over a very long run of spins. */
export interface MachineReturn {
    /** The average win as a fraction of the bet: 1.2 pays back 120%. */
    readonly rtp: number;
    /** The fraction of spins that win anything. */
    readonly hitRate: number;
    /** Each picture's share of `rtp`. */
    readonly rtpBySymbol: { readonly [P in PictureKind]: number };
}

export interface ComputeReturnOptions {
    /** One strip per reel. Wilds may be on any reel but the first. */
    readonly strips: readonly (readonly SymbolKind[])[];
    readonly paytable: Paytable;
    readonly bet: number;
    /** Rows in the window. */
    readonly rowCount: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * The exact return of a machine, worked out rather than simulated.
 *
 * Reels stop independently, and a way's picture is fixed by the first reel,
 * so the number of ways a picture wins is a product of per-reel counts: the
 * cells on each reel showing the picture (or a wild, after the first reel).
 * A product of independent counts averages to the product of their averages,
 * so a picture's expected win of exactly `k` reels is
 *
 *     pay(k) x mean(c1) x ... x mean(ck) x P(c(k+1) = 0)
 *
 * The hit rate isn't a product (pictures overlap), so it comes from counting
 * every combination of the first three reels' stops, which is enough: a spin
 * wins exactly when some picture spans them.
 */
export function computeReturn(options: ComputeReturnOptions): MachineReturn {
    const { strips, paytable, bet, rowCount } = options;
    const reelCount = strips.length;

    const rtpBySymbol = {} as Record<PictureKind, number>;
    let rtp = 0;
    for (const symbol of PICTURE_KINDS) {
        const counts = strips.map((strip, reel) => countStats(strip, symbol, reel > 0, rowCount));
        let ways = 1;
        let expectedWin = 0;
        for (let length = 1; length <= reelCount; length++) {
            ways *= counts[length - 1].mean;
            if (length < 3) continue;
            const ends = length === reelCount ? 1 : counts[length].zeroChance;
            expectedWin += paytable[symbol][length as WinLength] * ways * ends;
        }
        rtpBySymbol[symbol] = expectedWin / bet;
        rtp += rtpBySymbol[symbol];
    }

    return { rtp, hitRate: hitRateOf(strips, rowCount), rtpBySymbol };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CountStats {
    /** The mean number of matching cells in the window, over every stop. */
    readonly mean: number;
    /** The chance that no cell in the window matches. */
    readonly zeroChance: number;
}

function countStats(strip: readonly SymbolKind[], symbol: PictureKind, isWildMatching: boolean, rowCount: number): CountStats {
    let total = 0;
    let zeros = 0;
    for (let stop = 0; stop < strip.length; stop++) {
        let count = 0;
        for (let row = 0; row < rowCount; row++) {
            const shown = strip[(stop + row) % strip.length];
            if (shown === symbol || (isWildMatching && shown === 'wild')) count++;
        }
        total += count;
        if (count === 0) zeros++;
    }
    return { mean: total / strip.length, zeroChance: zeros / strip.length };
}

function hitRateOf(strips: readonly (readonly SymbolKind[])[], rowCount: number): number {
    // Each stop's window as a bitmask of the pictures it can match
    const masks = strips.slice(0, 3).map((strip, reel) => {
        const byStop: number[] = [];
        for (let stop = 0; stop < strip.length; stop++) {
            let mask = 0;
            for (let row = 0; row < rowCount; row++) {
                const shown = strip[(stop + row) % strip.length];
                mask |= shown === 'wild' ? (reel > 0 ? ALL_PICTURES : 0) : 1 << PICTURE_KINDS.indexOf(shown);
            }
            byStop.push(mask);
        }
        return byStop;
    });

    let hits = 0;
    for (const first of masks[0]) {
        for (const second of masks[1]) {
            const both = first & second;
            if (both === 0) continue;
            for (const third of masks[2]) {
                if ((both & third) !== 0) hits++;
            }
        }
    }
    return hits / (masks[0].length * masks[1].length * masks[2].length);
}

const ALL_PICTURES = (1 << PICTURE_KINDS.length) - 1;
