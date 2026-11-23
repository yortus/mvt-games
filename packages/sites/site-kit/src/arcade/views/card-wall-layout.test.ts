import { describe, expect, it } from 'vitest';
import { createCardWallLayout, type CardWallLayoutOptions } from './card-wall-layout';

const GAP = 10;
const MIN_COLUMN_WIDTH = 100;

describe('CardWallLayout', () => {
    it('fits as many columns as the width allows, up to the most allowed', () => {
        const cardWall = layout({ count: 0 });
        cardWall.setWidth(3 * MIN_COLUMN_WIDTH + 2 * GAP);
        cardWall.update(0);
        expect(cardWall.columnCount).toBe(3);
        expect(cardWall.columnWidth).toBe(MIN_COLUMN_WIDTH);
        cardWall.setWidth(3 * MIN_COLUMN_WIDTH + 2 * GAP - 1);
        cardWall.update(0);
        expect(cardWall.columnCount).toBe(2);
        cardWall.setWidth(100 * MIN_COLUMN_WIDTH);
        cardWall.update(0);
        expect(cardWall.columnCount).toBe(MAX_COLUMNS);
    });

    it('keeps the fewest columns allowed on a narrow card wall, narrowing them to fit', () => {
        const minColumns = 2;
        const cardWall = layout({ count: 0, minColumnCount: minColumns });
        const width = MIN_COLUMN_WIDTH;
        cardWall.setWidth(width);
        cardWall.update(0);
        expect(cardWall.columnCount).toBe(minColumns);
        expect(cardWall.columnWidth).toBe((width - (minColumns - 1) * GAP) / minColumns);
    });

    it('places each card in the shortest column so far', () => {
        const heights = [300, 100, 100, 100];
        const cardWall = layout({ count: heights.length });
        cardWall.setWidth(2 * MIN_COLUMN_WIDTH + GAP);
        heights.forEach((h, i) => cardWall.setCardHeightAt(i, h));
        cardWall.update(0);
        expect(positions(cardWall, heights.length)).toEqual([
            [0, 0],
            [MIN_COLUMN_WIDTH + GAP, 0],
            [MIN_COLUMN_WIDTH + GAP, 100 + GAP],
            [MIN_COLUMN_WIDTH + GAP, 2 * (100 + GAP)],
        ]);
        expect(cardWall.height).toBe(3 * 100 + 2 * GAP);
    });

    it('estimates the height of a card not yet measured', () => {
        const cardWall = layout({ count: 2, estimatedHeightAt: () => 50 });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        cardWall.update(0);
        expect(cardWall.yAt(1)).toBe(50 + GAP);
    });

    it('shows a card for the first time in its place, fading it in', () => {
        const cardWall = layout({ count: 1 });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        cardWall.setCardHeightAt(0, 100);
        cardWall.update(16);
        expect(cardWall.isVisibleAt(0)).toBe(true);
        expect(cardWall.yAt(0)).toBe(0);
        expect(cardWall.opacityAt(0)).toBeGreaterThan(0);
        expect(cardWall.opacityAt(0)).toBeLessThan(1);
        advance(cardWall, 2000);
        expect(cardWall.opacityAt(0)).toBe(1);
    });

    it('slides cards to new places when the order changes, and fades out the ones hidden', () => {
        const shown = [0, 1, 2];
        const cardWall = layout({ count: 3, shownCount: () => shown.length, shownIndexAt: (p) => shown[p] });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        for (let i = 0; i < 3; i++) cardWall.setCardHeightAt(i, 100);
        advance(cardWall, 2000);
        expect(cardWall.yAt(2)).toBe(2 * (100 + GAP));

        // Card 1 is filtered out: card 2 moves up into its place, and card 1 fades where it was
        shown.splice(1, 1);
        cardWall.update(16);
        expect(cardWall.yAt(2)).toBeLessThan(2 * (100 + GAP));
        expect(cardWall.yAt(2)).toBeGreaterThan(100 + GAP);
        expect(cardWall.isVisibleAt(1)).toBe(true);
        advance(cardWall, 2000);
        expect(cardWall.yAt(2)).toBe(100 + GAP);
        expect(cardWall.opacityAt(1)).toBe(0);
        expect(cardWall.isVisibleAt(1)).toBe(false);
    });

    it('slides cards aside for a card shown again, which fades in at its new place', () => {
        const shown = [0, 2];
        const cardWall = layout({ count: 3, shownCount: () => shown.length, shownIndexAt: (p) => shown[p] });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        for (let i = 0; i < 3; i++) cardWall.setCardHeightAt(i, 100);
        advance(cardWall, 2000);
        expect(cardWall.yAt(2)).toBe(100 + GAP);

        // Card 1 comes back between them: hidden, it measured 0, and now its height again
        cardWall.setCardHeightAt(1, 0);
        shown.splice(1, 0, 1);
        cardWall.setCardHeightAt(1, 100);
        cardWall.update(16);
        expect(cardWall.yAt(1)).toBe(100 + GAP);
        expect(cardWall.yAt(2)).toBeGreaterThan(100 + GAP);
        expect(cardWall.yAt(2)).toBeLessThan(2 * (100 + GAP));
        // It waits for card 2 to slide off its place, then fades in
        expect(cardWall.isVisibleAt(1)).toBe(true);
        expect(cardWall.opacityAt(1)).toBe(0);
        advance(cardWall, 200);
        expect(cardWall.opacityAt(1)).toBeGreaterThan(0);
        expect(cardWall.opacityAt(1)).toBeLessThan(1);
        advance(cardWall, 2000);
        expect(cardWall.opacityAt(1)).toBe(1);
        expect(cardWall.yAt(2)).toBe(2 * (100 + GAP));
    });

    it('slides cards aside for a card shown for the first time, whose height was as estimated', () => {
        const shown = [0, 2];
        const cardWall = layout({ count: 3, shownCount: () => shown.length, shownIndexAt: (p) => shown[p] });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        cardWall.setCardHeightAt(0, 100);
        cardWall.setCardHeightAt(2, 100);
        advance(cardWall, 2000);
        shown.splice(1, 0, 1);
        cardWall.setCardHeightAt(1, 100);
        cardWall.update(16);
        expect(cardWall.yAt(2)).toBeLessThan(2 * (100 + GAP));
    });

    it('snaps cards to their places when a first measure corrects an estimate', () => {
        const cardWall = layout({ count: 2, estimatedHeightAt: () => 50 });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        advance(cardWall, 2000);
        cardWall.setCardHeightAt(0, 100);
        cardWall.update(16);
        expect(cardWall.yAt(1)).toBe(100 + GAP);
    });

    it('snaps cards to their places when the width changes, rather than slide them all', () => {
        const cardWall = layout({ count: 2 });
        cardWall.setWidth(MIN_COLUMN_WIDTH);
        cardWall.setCardHeightAt(0, 100);
        cardWall.setCardHeightAt(1, 100);
        advance(cardWall, 2000);
        cardWall.setWidth(2 * MIN_COLUMN_WIDTH + GAP);
        cardWall.update(16);
        expect(positions(cardWall, 2)).toEqual([[0, 0], [MIN_COLUMN_WIDTH + GAP, 0]]);
    });

    it('shows nothing before it knows its width', () => {
        const cardWall = layout({ count: 2 });
        expect(cardWall.isVisibleAt(0)).toBe(false);
        cardWall.update(16);
        expect(cardWall.isVisibleAt(0)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_COLUMNS = 5;

function layout(overrides: Partial<CardWallLayoutOptions> & { count: number }): ReturnType<typeof createCardWallLayout> {
    return createCardWallLayout({
        gap: GAP,
        minColumnWidth: MIN_COLUMN_WIDTH,
        minColumnCount: 1,
        maxColumnCount: MAX_COLUMNS,
        shownCount: () => overrides.count,
        shownIndexAt: (p) => p,
        estimatedHeightAt: () => 100,
        ...overrides,
    });
}

function positions(cardWall: ReturnType<typeof createCardWallLayout>, count: number): [number, number][] {
    const result: [number, number][] = [];
    for (let i = 0; i < count; i++) result.push([cardWall.xAt(i), cardWall.yAt(i)]);
    return result;
}

function advance(cardWall: ReturnType<typeof createCardWallLayout>, totalMs: number): void {
    for (let t = 0; t < totalMs; t += 16) cardWall.update(16);
}
