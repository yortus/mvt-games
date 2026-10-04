import { describe, expect, it } from 'vitest';
import { CELEBRATION_OPENER_MS, FIRST_SETTLE_MS, SETTLE_DISTANCE, SETTLE_MS, SETTLE_STAGGER_MS, type SymbolKind } from '../../data';
import { createFruitMachineModel } from '../../models';
import { formatCredits, formatRows } from './format';
import { createLitCells } from './lit-cells';
import { easeClunk, easeOutBack, shownReelPosition } from './reel-landing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANDED_MS = FIRST_SETTLE_MS + 4 * SETTLE_STAGGER_MS + SETTLE_MS;

/** pic6 on every reel's first row, and nothing else matching: one way of five. */
const FIVE_WAY_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic6', 'pic1', 'pic2'],
    ['pic6', 'pic3', 'pic4'],
    ['pic6', 'pic1', 'pic2'],
    ['pic6', 'pic3', 'pic4'],
    ['pic6', 'pic1', 'pic5'],
];

function advance(model: ReturnType<typeof createFruitMachineModel>, totalMs: number): void {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 10) model.update(10);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reel landing', () => {
    it('leaves a reel that is not settling where the model has it', () => {
        const model = createFruitMachineModel({ seed: 2 });

        expect(shownReelPosition(model.reels[0], easeOutBack)).toBe(model.reels[0].position);
    });

    it('eases a settling reel from the settle distance above its stop down to the stop', () => {
        const model = createFruitMachineModel({ seed: 2 });
        void model.spin();
        advance(model, FIRST_SETTLE_MS);
        const reel = model.reels[0];

        expect(shownReelPosition(reel, easeOutBack)).toBeCloseTo(reel.stopIndex + SETTLE_DISTANCE);
        advance(model, SETTLE_MS - 10);
        expect(shownReelPosition(reel, easeOutBack)).toBeCloseTo(reel.stopIndex, 1);
    });

    it('lets each ease overshoot on the way, but end exactly at 1', () => {
        for (const ease of [easeOutBack, easeClunk]) {
            expect(ease(0)).toBeCloseTo(0);
            expect(ease(1)).toBeCloseTo(1, 10);
            let peak = 0;
            for (let t = 0; t <= 1; t += 0.01) peak = Math.max(peak, ease(t));
            expect(peak).toBeGreaterThan(1);
        }
    });
});

describe('lit cells', () => {
    it('lights nothing until a celebration, then every winning cell, then each way', () => {
        const model = createFruitMachineModel({ seed: 2, strips: FIVE_WAY_STRIPS });
        const lit = createLitCells({ celebration: model.celebration });
        expect(lit.isAnyLit).toBe(false);

        void model.spin();
        advance(model, LANDED_MS);
        const rows = model.outcome!.wins[0].rows;
        expect(lit.isAnyLit).toBe(true);
        for (let reel = 0; reel < 5; reel++) expect(lit.isLitAt(reel, rows[reel])).toBe(true);
        expect(lit.isLitAt(0, (rows[0] + 1) % 3)).toBe(false);

        advance(model, CELEBRATION_OPENER_MS);
        expect(model.celebration.win).toBeDefined();
        expect(lit.isLitAt(4, rows[4])).toBe(true);
    });
});

describe('formatting', () => {
    it('writes credits with thousands separated, and rows counting from 1', () => {
        expect(formatCredits(1250)).toBe('1,250');
        expect(formatRows([0, 2, 1])).toBe('1-3-2');
    });
});
