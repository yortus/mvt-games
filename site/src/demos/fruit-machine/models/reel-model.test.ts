import { describe, expect, it } from 'vitest';
import { PICTURE_KINDS, SETTLE_DISTANCE, SETTLE_MS, type SymbolKind } from '../data';
import { createReelModel, type ReelModel } from './reel-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Twelve symbols: the six pictures, twice. */
const STRIP: readonly SymbolKind[] = [...PICTURE_KINDS, ...PICTURE_KINDS];

function setup(stopIndex = 4): ReelModel {
    return createReelModel({ strip: STRIP, stopIndex });
}

function advance(reel: ReelModel, totalMs: number): void {
    const frameMs = 10;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) reel.update(frameMs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reel model', () => {
    it('rests at its stop', () => {
        const reel = setup(4);

        expect(reel.phase).toBe('stopped');
        expect(reel.position).toBe(4);
        expect(reel.progress).toBe(0);
    });

    it('reads its strip at any whole position, wrapping round', () => {
        const reel = setup();

        expect(reel.symbolAt(0)).toBe('pic1');
        expect(reel.symbolAt(13)).toBe('pic2');
        expect(reel.symbolAt(-1)).toBe('pic6');
    });

    it('turns at 20 positions a second, symbols moving down the window', () => {
        const reel = setup(4);
        reel.spin({ stopIndex: 5, settleAfterMs: 1000 });

        advance(reel, 100);

        expect(reel.phase).toBe('spinning');
        expect(reel.position).toBeCloseTo(2);
    });

    it('wraps its position into the strip', () => {
        const reel = setup(0);
        reel.spin({ stopIndex: 5, settleAfterMs: 1000 });

        advance(reel, 100);

        expect(reel.position).toBeCloseTo(10);
    });

    it('starts settling on time, from the settle distance above its stop', () => {
        const reel = setup(4);
        reel.spin({ stopIndex: 5, settleAfterMs: 1000 });

        advance(reel, 990);
        expect(reel.phase).toBe('spinning');

        advance(reel, 10);
        expect(reel.phase).toBe('settling');
        expect(reel.position).toBe(5 + SETTLE_DISTANCE);
    });

    it('settles linearly, and lands exactly on its stop', () => {
        const reel = setup(4);
        reel.spin({ stopIndex: 5, settleAfterMs: 1000 });
        advance(reel, 1000);

        advance(reel, SETTLE_MS / 2);
        expect(reel.progress).toBeCloseTo(0.5);
        expect(reel.position).toBeCloseTo(5 + SETTLE_DISTANCE / 2);

        advance(reel, SETTLE_MS / 2);
        expect(reel.phase).toBe('stopped');
        expect(reel.position).toBe(5);
        expect(reel.progress).toBe(0);
    });

    it('lands the same from one large update as from many small ones', () => {
        const stepped = setup(4);
        const leapt = setup(4);
        stepped.spin({ stopIndex: 2, settleAfterMs: 1500 });
        leapt.spin({ stopIndex: 2, settleAfterMs: 1500 });

        advance(stepped, 1500 + SETTLE_MS);
        leapt.update(1500 + SETTLE_MS);

        expect(leapt.phase).toBe('stopped');
        expect(leapt.position).toBe(stepped.position);
    });

    it('spins only from rest', () => {
        const reel = setup();
        reel.spin({ stopIndex: 1, settleAfterMs: 1000 });

        expect(() => reel.spin({ stopIndex: 2, settleAfterMs: 1000 })).toThrow();
    });

    describe('hurrying', () => {
        it('settles at once when spinning, landing within the time given', () => {
            const reel = setup(4);
            reel.spin({ stopIndex: 5, settleAfterMs: 1000 });
            advance(reel, 300);

            reel.hurry(200);
            expect(reel.phase).toBe('settling');
            expect(reel.position).toBe(5 + SETTLE_DISTANCE);

            advance(reel, 200);
            expect(reel.phase).toBe('stopped');
            expect(reel.position).toBe(5);
        });

        it('speeds up a settle without losing its progress', () => {
            const reel = setup(4);
            reel.spin({ stopIndex: 5, settleAfterMs: 0 });
            advance(reel, 100);
            const progress = reel.progress;

            reel.hurry(50);
            expect(reel.progress).toBe(progress);

            advance(reel, 50);
            expect(reel.phase).toBe('stopped');
        });

        it('never slows a settle down', () => {
            const reel = setup(4);
            reel.spin({ stopIndex: 5, settleAfterMs: 0 });
            advance(reel, SETTLE_MS - 50);

            reel.hurry(200);
            advance(reel, 50);

            expect(reel.phase).toBe('stopped');
        });

        it('does nothing at rest', () => {
            const reel = setup(4);

            reel.hurry(200);

            expect(reel.phase).toBe('stopped');
            expect(reel.position).toBe(4);
        });
    });
});
