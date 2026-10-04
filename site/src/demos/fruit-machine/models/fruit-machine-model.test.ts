import { describe, expect, it } from 'vitest';
import {
    BET, CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS, FIRST_SETTLE_MS, PAYTABLE, ROW_COUNT, SETTLE_MS,
    SETTLE_STAGGER_MS, STARTING_BALANCE, STOPPING_SETTLE_MS, type SymbolKind,
} from '../data';
import { createFruitMachineModel, type FruitMachineModel, type FruitMachineModelOptions } from './fruit-machine-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** When the last reel lands, from the start of a spin. */
const LANDED_MS = FIRST_SETTLE_MS + 4 * SETTLE_STAGGER_MS + SETTLE_MS;

/**
 * Strips of exactly three symbols, so the window always shows the whole strip
 * and every spin has the same wins whatever the stops: here, one way, pic1
 * on the first three reels.
 */
const ONE_WAY_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic1', 'pic5'],
    ['pic6', 'pic4', 'pic1'],
    ['pic2', 'pic3', 'pic4'],
    ['pic5', 'pic6', 'pic2'],
];

/** Strips that never win: no picture on the first reel is on the second. */
const LOSING_STRIPS: readonly (readonly SymbolKind[])[] = [
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
    ['pic4', 'pic5', 'pic6'],
    ['pic1', 'pic2', 'pic3'],
];

function setup(options: FruitMachineModelOptions = {}): FruitMachineModel {
    return createFruitMachineModel({ seed: 7, ...options });
}

function advance(model: FruitMachineModel, totalMs: number): void {
    const frameMs = 10;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) model.update(frameMs);
}

/** Lets the promise callbacks queued so far run. */
async function flushPromises(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Whether a promise has resolved, once pending callbacks have run. */
async function hasResolved(promise: Promise<unknown>): Promise<boolean> {
    let resolved = false;
    void promise.then(() => {
        resolved = true;
    });
    await flushPromises();
    return resolved;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fruit machine model', () => {
    it('starts idle, with its starting balance, ready to spin', () => {
        const model = setup();

        expect(model.phase).toBe('idle');
        expect(model.balance).toBe(STARTING_BALANCE);
        expect(model.lastWin).toBe(0);
        expect(model.spinCount).toBe(0);
        expect(model.outcome).toBeUndefined();
        expect(model.canSpin).toBe(true);
        expect(model.canStop).toBe(false);
        expect(model.reels.every((reel) => reel.phase === 'stopped')).toBe(true);
    });

    it('refuses a wild on the first reel', () => {
        const strips: (readonly SymbolKind[])[] = [['wild', 'pic1', 'pic2'], ...LOSING_STRIPS.slice(1)];

        expect(() => setup({ strips })).toThrow();
    });

    it('plays the same spins from the same seed', () => {
        const a = setup({ seed: 99 });
        const b = setup({ seed: 99 });

        void a.spin();
        void b.spin();

        expect(a.outcome).toEqual(b.outcome);
    });

    describe('spinning', () => {
        it('takes the bet and decides the result at once', () => {
            const model = setup();

            void model.spin();

            expect(model.phase).toBe('spinning');
            expect(model.balance).toBe(STARTING_BALANCE - BET);
            expect(model.spinCount).toBe(1);
            expect(model.outcome).toBeDefined();
            expect(model.reels.every((reel) => reel.phase === 'spinning')).toBe(true);
        });

        it('allows stopping, but not another spin', () => {
            const model = setup();

            void model.spin();

            expect(model.canSpin).toBe(false);
            expect(model.canStop).toBe(true);
            expect(() => model.spin()).toThrow();
        });

        it('settles the reels from one second in, half a second apart, left to right', () => {
            for (let reel = 0; reel < 5; reel++) {
                const settleAt = FIRST_SETTLE_MS + reel * SETTLE_STAGGER_MS;
                const model = setup();
                void model.spin();

                advance(model, settleAt - 10);
                expect(model.reels[reel].phase).toBe('spinning');

                advance(model, 10);
                expect(model.reels[reel].phase).toBe('settling');
            }
        });

        it('lands the reels on the window it decided', () => {
            const model = setup();
            void model.spin();

            advance(model, LANDED_MS);

            const { stops, window } = model.outcome!;
            for (let reel = 0; reel < model.reels.length; reel++) {
                expect(model.reels[reel].phase).toBe('stopped');
                expect(model.reels[reel].position).toBe(stops[reel]);
                for (let row = 0; row < ROW_COUNT; row++) {
                    expect(model.reels[reel].symbolAt(stops[reel] + row)).toBe(window[reel][row]);
                }
            }
        });

        it('pays the win when the last reel lands, not before', () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            void model.spin();

            advance(model, LANDED_MS - 10);
            expect(model.lastWin).toBe(0);

            advance(model, 10);
            expect(model.outcome!.totalWin).toBe(PAYTABLE.pic1[3]);
            expect(model.lastWin).toBe(PAYTABLE.pic1[3]);
            expect(model.balance).toBe(STARTING_BALANCE - BET + PAYTABLE.pic1[3]);
        });

        it('clears the last win at the start of the next spin', () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            void model.spin();
            advance(model, LANDED_MS);
            model.stop();

            void model.spin();

            expect(model.lastWin).toBe(0);
        });
    });

    describe('after the reels land', () => {
        it('goes idle and resolves the spin when nothing was won', async () => {
            const model = setup({ strips: LOSING_STRIPS });
            const spin = model.spin();

            advance(model, LANDED_MS);

            expect(model.phase).toBe('idle');
            expect(model.celebration.isActive).toBe(false);
            expect(await spin).toBe(model.outcome);
        });

        it('celebrates a win, then goes idle and resolves the spin', async () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            const spin = model.spin();

            advance(model, LANDED_MS);
            expect(model.phase).toBe('celebrating');
            expect(model.canSpin).toBe(false);
            expect(model.canStop).toBe(true);
            expect(model.celebration.wins).toBe(model.outcome!.wins);
            expect(await hasResolved(spin)).toBe(false);

            // The opener, then the one way
            advance(model, CELEBRATION_OPENER_MS + CELEBRATION_STEP_MS);
            expect(model.phase).toBe('idle');
            expect(await hasResolved(spin)).toBe(true);
        });
    });

    describe('stopping', () => {
        it('lands a spin quickly, then pays and celebrates it as usual', async () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            const spin = model.spin();
            advance(model, 300);

            model.stop();
            expect(model.isStopping).toBe(true);
            expect(model.canStop).toBe(false);

            advance(model, STOPPING_SETTLE_MS);
            expect(model.reels.every((reel) => reel.phase === 'stopped')).toBe(true);
            expect(model.isStopping).toBe(false);
            expect(model.lastWin).toBe(PAYTABLE.pic1[3]);
            expect(model.phase).toBe('celebrating');
            expect(model.canStop).toBe(true);
            expect(await hasResolved(spin)).toBe(false);

            advance(model, CELEBRATION_OPENER_MS + CELEBRATION_STEP_MS);
            expect(model.phase).toBe('idle');
            expect(await spin).toBe(model.outcome);
        });

        it('takes a second stop to cut the celebration short', async () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            const spin = model.spin();
            model.stop();
            advance(model, STOPPING_SETTLE_MS);

            model.stop();

            expect(model.phase).toBe('idle');
            expect(model.spinCount).toBe(1);
            expect(await spin).toBe(model.outcome);
        });

        it('goes straight to idle after a stopped spin that won nothing', () => {
            const model = setup({ strips: LOSING_STRIPS });
            void model.spin();

            model.stop();
            advance(model, STOPPING_SETTLE_MS);

            expect(model.phase).toBe('idle');
        });

        it('lands reels already settling within the same time', () => {
            const model = setup();
            void model.spin();
            advance(model, FIRST_SETTLE_MS + 100);

            model.stop();
            advance(model, STOPPING_SETTLE_MS);

            expect(model.reels.every((reel) => reel.phase === 'stopped')).toBe(true);
            expect(model.phase).not.toBe('spinning');
        });

        it('ends a celebration at once, and resolves the spin', async () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            const spin = model.spin();
            advance(model, LANDED_MS);
            const balance = model.balance;

            model.stop();

            expect(model.phase).toBe('idle');
            expect(model.celebration.isActive).toBe(false);
            expect(model.balance).toBe(balance);
            expect(await hasResolved(spin)).toBe(true);
        });

        it('never starts a spin', () => {
            const model = setup({ strips: ONE_WAY_STRIPS });
            void model.spin();
            advance(model, LANDED_MS);

            model.stop();

            expect(model.spinCount).toBe(1);
            expect(model.phase).toBe('idle');
        });

        it('is refused when there is nothing to stop', () => {
            const model = setup();

            expect(() => model.stop()).toThrow();
        });
    });

    describe('game over', () => {
        it('comes when the machine goes idle with less than a bet', async () => {
            const model = setup({ strips: LOSING_STRIPS, startingBalance: BET });
            const spin = model.spin();

            advance(model, LANDED_MS);

            expect(model.phase).toBe('gameOver');
            expect(model.canSpin).toBe(false);
            expect(model.canStop).toBe(false);
            expect(await spin).toBe(model.outcome);
        });

        it('waits for the celebration to end', () => {
            // The one way pays less than the bet, so the balance falls short of another spin
            const paytable = { ...PAYTABLE, pic1: { 3: BET - 10, 4: BET, 5: BET } };
            const model = setup({ strips: ONE_WAY_STRIPS, paytable, startingBalance: BET });
            void model.spin();

            advance(model, LANDED_MS);
            expect(model.phase).toBe('celebrating');

            advance(model, CELEBRATION_OPENER_MS + CELEBRATION_STEP_MS);
            expect(model.phase).toBe('gameOver');
        });

        it('is where a machine without a bet to start with begins', () => {
            const model = setup({ startingBalance: BET - 1 });

            expect(model.phase).toBe('gameOver');
            expect(model.canSpin).toBe(false);
        });

        it('lasts: nothing leaves it', () => {
            const model = setup({ strips: LOSING_STRIPS, startingBalance: BET });
            void model.spin();
            advance(model, LANDED_MS);

            advance(model, 10_000);

            expect(model.phase).toBe('gameOver');
            expect(() => model.spin()).toThrow();
            expect(() => model.stop()).toThrow();
        });
    });
});
