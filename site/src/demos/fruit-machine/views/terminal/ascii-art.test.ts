import { describe, expect, it } from 'vitest';
import { PAYTABLE } from '../../data';
import { drawBanner, drawPaytable, drawWindowBox } from './ascii-art';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ascii art', () => {
    it('draws the window as a box of equal-width columns, lit cells in brackets', () => {
        const box = drawWindowBox({
            reelCount: 5,
            rowCount: 3,
            symbolAt: () => 'pic3',
            isLitAt: (reel, row) => reel === row,
        });
        const lines = box.split('\n');

        expect(lines).toHaveLength(5);
        expect(new Set(lines.map((line) => line.length)).size).toBe(1);
        expect(lines[1]).toBe('│[CHERRY]│ CHERRY │ CHERRY │ CHERRY │ CHERRY │');
    });

    it('draws a banner whose lines all line up', () => {
        const lines = drawBanner().split('\n');

        expect(new Set(lines.map((line) => line.length)).size).toBe(1);
    });

    it('lists every fruit in the paytable', () => {
        const text = drawPaytable(PAYTABLE);

        for (const label of ['MELON', 'GRAPES', 'CHERRY', 'ORANGE', 'LEMON', 'BERRY', '*WILD*']) expect(text).toContain(label);
    });
});
