import { assert } from '@mvtjs/utils';
import {
    BET, FIRST_SETTLE_MS, PAYTABLE, type Paytable, REEL_STRIPS, ROW_COUNT, SETTLE_STAGGER_MS, STARTING_BALANCE,
    STOPPING_SETTLE_MS, type SymbolKind,
} from '../data';
import { type CelebrationModel, createCelebrationModel } from './celebration-model';
import { evaluateWays, type WayWin } from './evaluate-ways';
import { createRandom } from './random';
import { createReelModel, type ReelModel } from './reel-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * `'celebrating'` while the wins are shown off after the reels land.
 * `'gameOver'` once the balance can't cover a bet; nothing leaves it.
 */
export type MachinePhase = 'idle' | 'spinning' | 'celebrating' | 'gameOver';

/**
 * The fruit machine: five reels, a balance, and the two things a player can
 * do, spin and stop. The demo's one model, which every view reads and any
 * view may act on.
 *
 * A spin's result is decided the moment it starts; the reels then take their
 * time to show it. They spin together, start to settle one second in, half a
 * second apart from left to right, and each takes half a second to land.
 * The win is paid when the last one lands, then celebrated, a way at a time.
 *
 * Not leap-safe across phases: each `update` moves on at most one phase, so a
 * spin and its celebration take at least two calls.
 */
export interface FruitMachineModel {
    /** The reels, first reel first. Driven by the machine: read them, don't call them. */
    readonly reels: readonly ReelModel[];
    readonly phase: MachinePhase;
    /** True from a `stop()` during a spin until the reels land. */
    readonly isStopping: boolean;

    /** Credits held. */
    readonly balance: number;
    /** Credits each spin costs. */
    readonly bet: number;
    /** What the last spin to land won. 0 from the start of each spin. */
    readonly lastWin: number;
    /** Spins so far. Watch it to notice a new spin, wherever it was started. */
    readonly spinCount: number;
    /** The current, or last, spin's result, decided when it started. Undefined before the first spin. */
    readonly outcome: SpinOutcome | undefined;
    readonly celebration: CelebrationModel;

    /** True when `spin()` may be called: when idle. */
    readonly canSpin: boolean;
    /** True when `stop()` may be called: while spinning, until stopped, and while celebrating. */
    readonly canStop: boolean;
    /**
     * Take the bet, decide the result, and spin. Resolves with the result
     * once the machine is idle again (or the game is over): after the
     * reels land and any celebration ends. Resolves from inside `update`,
     * so a machine that isn't updated never resolves. Needs `canSpin`.
     */
    spin: () => Promise<SpinOutcome>;
    /**
     * Cut short whatever is running. During a spin, land the reels within a
     * fifth of a second; the win is paid and celebrated as usual. During a
     * celebration, end it at once, ready for the next spin. Never starts a
     * spin. Needs `canStop`.
     */
    stop: () => void;
    update: (deltaMs: number) => void;
}

/** A spin's result. */
export interface SpinOutcome {
    /** Each reel's stop, first reel first. */
    readonly stops: readonly number[];
    /** The symbols the reels land on, `window[reel][row]`. */
    readonly window: readonly (readonly SymbolKind[])[];
    /** Every winning way, highest payout first. */
    readonly wins: readonly WayWin[];
    /** Credits won: the sum of the ways' payouts. */
    readonly totalWin: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FruitMachineModelOptions {
    /** Seed for the reels' stops. Defaults to 1. */
    readonly seed?: number;
    /** Defaults to the machine's strips. A wild on the first reel is not allowed. */
    readonly strips?: readonly (readonly SymbolKind[])[];
    /** Defaults to the machine's paytable. */
    readonly paytable?: Paytable;
    /** Defaults to the machine's starting balance (`STARTING_BALANCE`). */
    readonly startingBalance?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFruitMachineModel(options: FruitMachineModelOptions = {}): FruitMachineModel {
    const {
        seed = 1,
        strips = REEL_STRIPS,
        paytable = PAYTABLE,
        startingBalance = STARTING_BALANCE,
    } = options;
    assert(!strips[0].includes('wild'), 'The first reel has no wilds: a way takes its picture from it');

    const random = createRandom({ seed });
    const reels = strips.map((strip) => createReelModel({ strip, stopIndex: random.nextIndex(strip.length) }));
    const celebration = createCelebrationModel();

    let phase: MachinePhase = startingBalance < BET ? 'gameOver' : 'idle';
    let isStopping = false;
    let balance = startingBalance;
    let lastWin = 0;
    let spinCount = 0;
    let outcome: SpinOutcome | undefined;
    let resolveSpin: ((outcome: SpinOutcome) => void) | undefined;

    const model: FruitMachineModel = {
        reels,
        get phase() { return phase; },
        get isStopping() { return isStopping; },
        get balance() { return balance; },
        bet: BET,
        get lastWin() { return lastWin; },
        get spinCount() { return spinCount; },
        get outcome() { return outcome; },
        celebration,

        get canSpin() { return phase === 'idle'; },
        get canStop() { return (phase === 'spinning' && !isStopping) || phase === 'celebrating'; },

        spin() {
            assert(model.canSpin, () => `spin() needs canSpin, but the machine is ${phase}`);
            balance -= BET;
            lastWin = 0;
            spinCount++;
            outcome = decideOutcome();
            for (let i = 0; i < reels.length; i++) {
                reels[i].spin({ stopIndex: outcome.stops[i], settleAfterMs: FIRST_SETTLE_MS + i * SETTLE_STAGGER_MS });
            }
            phase = 'spinning';
            return new Promise((resolve) => {
                resolveSpin = resolve;
            });
        },

        stop() {
            assert(model.canStop, () => `stop() needs canStop, but the machine is ${phase}`);
            if (phase === 'spinning') {
                isStopping = true;
                for (let i = 0; i < reels.length; i++) reels[i].hurry(STOPPING_SETTLE_MS);
            }
            else {
                celebration.stop();
                finishSpin();
            }
        },

        update(deltaMs) {
            // Advance
            for (let i = 0; i < reels.length; i++) reels[i].update(deltaMs);
            celebration.update(deltaMs);

            // Orchestrate
            if (phase === 'spinning' && haveReelsStopped()) land();
            else if (phase === 'celebrating' && !celebration.isActive) finishSpin();
        },
    };

    return model;

    function decideOutcome(): SpinOutcome {
        const stops = reels.map((reel) => random.nextIndex(reel.strip.length));
        const window = reels.map((reel, i) => {
            const rows: SymbolKind[] = [];
            for (let row = 0; row < ROW_COUNT; row++) rows.push(reel.symbolAt(stops[i] + row));
            return rows;
        });
        const wins = evaluateWays({ window, paytable });
        let totalWin = 0;
        for (const win of wins) totalWin += win.payout;
        return { stops, window, wins, totalWin };
    }

    /** The last reel has landed: pay, then celebrate any wins, stopped early or not. */
    function land(): void {
        const { wins, totalWin } = outcome!;
        balance += totalWin;
        lastWin = totalWin;
        if (wins.length > 0) {
            phase = 'celebrating';
            celebration.start(wins);
        }
        else {
            finishSpin();
        }
        isStopping = false;
    }

    function finishSpin(): void {
        phase = balance < BET ? 'gameOver' : 'idle';
        const resolve = resolveSpin!;
        resolveSpin = undefined;
        resolve(outcome!);
    }

    function haveReelsStopped(): boolean {
        for (let i = 0; i < reels.length; i++) {
            if (reels[i].phase !== 'stopped') return false;
        }
        return true;
    }
}
