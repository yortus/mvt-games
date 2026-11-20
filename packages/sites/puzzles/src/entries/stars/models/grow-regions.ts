import type { Random } from '@mvtjs/site-kit/random';
import { STAR } from './cell-states';
import type { StarGrid } from './star-grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GrowRegionsOptions {
    readonly grid: StarGrid;
    /** The stars the regions are drawn around, two in every row and column. */
    readonly solution: Readonly<Uint8Array>;
    readonly random: Random;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns regions drawn around `solution`'s stars, two stars in each, as a
 * region number for each cell, or undefined if this try didn't work out.
 *
 * It grows a piece of region from each star: a random empty cell beside a
 * piece joins it, until every cell is in one. Then it pairs each piece with
 * a piece beside it, so the pieces make whole regions of two stars each.
 * The pairing is a small search that pairs the piece with the fewest
 * choices first. Now and then no pairing exists, and the caller tries
 * again.
 */
export function growRegions(options: GrowRegionsOptions): Uint8Array | undefined {
    const { grid, solution, random } = options;
    const { cellCount, sides } = grid;

    // Half a region from each star
    const half = new Int32Array(cellCount).fill(-1);
    let halfCount = 0;
    for (let cell = 0; cell < cellCount; cell++) {
        if (solution[cell] === STAR) half[cell] = halfCount++;
    }
    let left = cellCount - halfCount;
    const choices = new Int32Array(4);
    while (left > 0) {
        const cell = random.nextIndex(cellCount);
        if (half[cell] >= 0) continue;
        let choiceCount = 0;
        for (let side = 0; side < 4; side++) {
            const next = sides[cell * 4 + side];
            if (next >= 0 && half[next] >= 0) choices[choiceCount++] = half[next];
        }
        if (choiceCount === 0) continue;
        half[cell] = choices[random.nextIndex(choiceCount)];
        left--;
    }

    // Which halves are beside which
    const isBeside: boolean[][] = Array.from({ length: halfCount }, () => new Array<boolean>(halfCount).fill(false));
    for (let cell = 0; cell < cellCount; cell++) {
        for (let side = 0; side < 4; side++) {
            const next = sides[cell * 4 + side];
            if (next >= 0 && half[next] !== half[cell]) isBeside[half[cell]][half[next]] = true;
        }
    }

    // Pair them up
    const mate = new Int32Array(halfCount).fill(-1);
    let steps = 0;
    if (!pairHalves()) return undefined;
    const regionOfHalf = new Int32Array(halfCount).fill(-1);
    let regionCount = 0;
    for (let h = 0; h < halfCount; h++) {
        if (regionOfHalf[h] >= 0) continue;
        regionOfHalf[h] = regionCount;
        regionOfHalf[mate[h]] = regionCount;
        regionCount++;
    }
    const regions = new Uint8Array(cellCount);
    for (let cell = 0; cell < cellCount; cell++) regions[cell] = regionOfHalf[half[cell]];
    return regions;

    function pairHalves(): boolean {
        if (++steps > MOST_PAIRING_STEPS) return false;
        // The unpaired half with the fewest unpaired halves beside it
        let best = -1;
        let bestOptions: number[] = [];
        for (let h = 0; h < halfCount; h++) {
            if (mate[h] >= 0) continue;
            const options: number[] = [];
            for (let g = 0; g < halfCount; g++) {
                if (isBeside[h][g] && mate[g] < 0) options.push(g);
            }
            if (options.length === 0) return false;
            if (best < 0 || options.length < bestOptions.length) {
                best = h;
                bestOptions = options;
            }
        }
        if (best < 0) return true;
        // Try its choices in a random order
        for (let i = bestOptions.length - 1; i > 0; i--) {
            const j = random.nextIndex(i + 1);
            const option = bestOptions[i];
            bestOptions[i] = bestOptions[j];
            bestOptions[j] = option;
        }
        for (let i = 0; i < bestOptions.length; i++) {
            const g = bestOptions[i];
            mate[best] = g;
            mate[g] = best;
            if (pairHalves()) return true;
            mate[best] = -1;
            mate[g] = -1;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the pairing searches before this try is given up. */
const MOST_PAIRING_STEPS = 20_000;
