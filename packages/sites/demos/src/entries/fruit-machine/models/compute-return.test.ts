import { describe, expect, it } from 'vitest';
import { BET, PAYTABLE, REEL_STRIPS, ROW_COUNT, STOPPING_SETTLE_MS, type SymbolKind } from '../data';
import { computeReturn } from './compute-return';
import { createFruitMachineModel } from './fruit-machine-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The long runs take a second or two alone, and several times that while the
 * whole suite runs beside them. They are seeded, so they are slow, not flaky.
 */
const LONG_RUN_TIMEOUT_MS = 20_000;

const MACHINE = computeReturn({ strips: REEL_STRIPS, paytable: PAYTABLE, bet: BET, rowCount: ROW_COUNT });

/** Play a spin to the end quickly: stopped at once, it lands in one update; a second stop ends any celebration. */
function quickSpin(model: ReturnType<typeof createFruitMachineModel>): void {
    void model.spin();
    model.stop();
    model.update(STOPPING_SETTLE_MS);
    if (model.canStop) model.stop();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeReturn', () => {
    it('works out a machine simple enough to check by hand', () => {
        // Every reel shows nothing but pic6, so every spin wins all 243 ways of five
        const strips: SymbolKind[][] = [];
        for (let reel = 0; reel < 5; reel++) strips.push(['pic6', 'pic6', 'pic6']);

        const result = computeReturn({ strips, paytable: PAYTABLE, bet: BET, rowCount: ROW_COUNT });

        expect(result.rtp).toBeCloseTo(243 * PAYTABLE.pic6[5] / BET);
        expect(result.rtpBySymbol.pic6).toBe(result.rtp);
        expect(result.hitRate).toBe(1);
    });

    describe("the machine's strips and paytable", () => {
        it('pay back about 85%, less than they take, as a real machine does', () => {
            const breakdown = JSON.stringify(MACHINE.rtpBySymbol);

            expect(MACHINE.rtp, `RTP by symbol: ${breakdown}`).toBeGreaterThan(0.82);
            expect(MACHINE.rtp, `RTP by symbol: ${breakdown}`).toBeLessThan(0.88);
        });

        it('pay something on most spins, mostly less than the bet', () => {
            expect(MACHINE.hitRate).toBeGreaterThan(0.7);
            expect(MACHINE.hitRate).toBeLessThan(0.9);
        });

        it('agree with a long run of the machine itself', () => {
            const model = createFruitMachineModel({ seed: 12345 });
            const spins = 50_000;
            let won = 0;
            let hits = 0;

            for (let i = 0; i < spins; i++) {
                quickSpin(model);
                won += model.lastPaid;
                if (model.lastPaid > 0) hits++;
            }

            expect(won / spins / BET).toBeCloseTo(MACHINE.rtp, 1);
            expect(hits / spins).toBeCloseTo(MACHINE.hitRate, 2);
        }, LONG_RUN_TIMEOUT_MS);
    });
});
