import { describe, expect, it } from 'vitest';
import { PAYTABLE, type SymbolKind } from '../data';
import { evaluateWays } from './evaluate-ways';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A window written as rows, top to bottom, the way it looks; returned as reels. */
function windowOf(...rows: readonly (readonly SymbolKind[])[]): SymbolKind[][] {
    return rows[0].map((_, reel) => rows.map((row) => row[reel]));
}

function waysIn(window: readonly (readonly SymbolKind[])[]) {
    return evaluateWays({ window, paytable: PAYTABLE });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateWays', () => {
    it('finds nothing in a window without three in a row', () => {
        const wins = waysIn(windowOf(
            ['pic1', 'pic2', 'pic5', 'pic4', 'pic5'],
            ['pic2', 'pic3', 'pic4', 'pic5', 'pic6'],
            ['pic3', 'pic4', 'pic5', 'pic6', 'pic1'],
        ));

        expect(wins).toEqual([]);
    });

    it('pays three of a kind on any rows, from the first reel', () => {
        const wins = waysIn(windowOf(
            ['pic1', 'pic2', 'pic6', 'pic4', 'pic5'],
            ['pic2', 'pic3', 'pic1', 'pic5', 'pic6'],
            ['pic3', 'pic1', 'pic4', 'pic6', 'pic2'],
        ));

        expect(wins).toEqual([{ symbol: 'pic1', rows: [0, 2, 1], payout: PAYTABLE.pic1[3] }]);
    });

    it('pays four and five of a kind at their own rates, once each', () => {
        const four = waysIn(windowOf(
            ['pic3', 'pic3', 'pic3', 'pic3', 'pic1'],
            ['pic1', 'pic2', 'pic4', 'pic5', 'pic2'],
            ['pic2', 'pic4', 'pic5', 'pic6', 'pic4'],
        ));
        const five = waysIn(windowOf(
            ['pic3', 'pic3', 'pic3', 'pic3', 'pic3'],
            ['pic1', 'pic2', 'pic4', 'pic5', 'pic2'],
            ['pic2', 'pic4', 'pic5', 'pic6', 'pic4'],
        ));

        expect(four).toEqual([{ symbol: 'pic3', rows: [0, 0, 0, 0], payout: PAYTABLE.pic3[4] }]);
        expect(five).toEqual([{ symbol: 'pic3', rows: [0, 0, 0, 0, 0], payout: PAYTABLE.pic3[5] }]);
    });

    it('lets a wild stand in for any picture', () => {
        const wins = waysIn(windowOf(
            ['pic5', 'wild', 'pic5', 'pic1', 'pic2'],
            ['pic1', 'pic2', 'pic3', 'pic4', 'pic6'],
            ['pic2', 'pic3', 'pic4', 'pic6', 'pic1'],
        ));

        expect(wins).toEqual([{ symbol: 'pic5', rows: [0, 0, 0], payout: PAYTABLE.pic5[3] }]);
    });

    it('lets one wild serve more than one picture', () => {
        const wins = waysIn(windowOf(
            ['pic5', 'wild', 'pic5', 'pic3', 'pic3'],
            ['pic6', 'pic2', 'pic6', 'pic4', 'pic4'],
            ['pic2', 'pic3', 'pic2', 'pic2', 'pic1'],
        ));

        expect(new Set(wins.map((win) => win.symbol))).toEqual(new Set(['pic2', 'pic5', 'pic6']));
    });

    it('pays every way through the matching cells', () => {
        // pic4 on two rows of the first two reels, one of the third: 2 x 2 x 1 ways
        const wins = waysIn(windowOf(
            ['pic4', 'pic4', 'pic5', 'pic2', 'pic3'],
            ['pic4', 'wild', 'pic4', 'pic3', 'pic2'],
            ['pic1', 'pic2', 'pic3', 'pic5', 'pic6'],
        ));

        expect(wins.map((win) => win.rows)).toEqual([[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 1]]);
    });

    it('pays all 243 ways of a full window', () => {
        const pic6 = ['pic6', 'pic6', 'pic6', 'pic6', 'pic6'] as const;

        const wins = waysIn(windowOf(pic6, pic6, pic6));

        expect(wins).toHaveLength(243);
        expect(wins.every((win) => win.rows.length === 5 && win.payout === PAYTABLE.pic6[5])).toBe(true);
    });

    it('needs the reels to be adjacent', () => {
        const wins = waysIn(windowOf(
            ['pic2', 'pic2', 'pic1', 'pic2', 'pic2'],
            ['pic3', 'pic4', 'pic5', 'pic6', 'pic1'],
            ['pic4', 'pic5', 'pic6', 'pic1', 'pic3'],
        ));

        expect(wins).toEqual([]);
    });

    it('starts no way from a wild on the first reel', () => {
        const wins = waysIn(windowOf(
            ['wild', 'pic2', 'pic2', 'pic1', 'pic3'],
            ['pic3', 'pic4', 'pic5', 'pic6', 'pic1'],
            ['pic4', 'pic5', 'pic6', 'pic2', 'pic4'],
        ));

        expect(wins).toEqual([]);
    });

    it('lists the highest payouts first', () => {
        const wins = waysIn(windowOf(
            ['pic6', 'pic6', 'pic6', 'pic1', 'pic2'],
            ['pic1', 'pic1', 'pic1', 'pic1', 'pic3'],
            ['pic2', 'pic3', 'pic4', 'pic5', 'pic4'],
        ));

        // pic1 wins two ways of four reels; pic6 one way of three
        expect(wins.map((win) => win.symbol)).toEqual(['pic1', 'pic1', 'pic6']);
    });
});
