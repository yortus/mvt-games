import type { DiggerModel } from './digger-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long each run's result shows before the next run starts, in ms. */
const ASSERT_MS = 2400;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether the run is moving time on, or showing what the test's check found. */
export type TestRunPhase = 'acting' | 'asserting';

/**
 * Runs one test over and over, as a test runner would, but slowly enough to
 * watch. Each run starts a new digger, moves time on for a set while, then
 * holds still for a moment, so you can read the result.
 */
export interface TestRunModel {
    readonly phase: TestRunPhase;
    /** This run's digger. */
    readonly digger: DiggerModel;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TestRunModelOptions {
    /** Starts each run: makes a digger, and does what the test does to it before time passes. */
    readonly startRun: () => DiggerModel;
    /** How much time each run moves on, in ms. */
    readonly runMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a test run, with its first run just started. */
export function createTestRunModel({ startRun, runMs }: TestRunModelOptions): TestRunModel {
    let phase: TestRunPhase = 'acting';
    let digger = startRun();
    // How long the run has been in its phase, in ms
    let phaseMs = 0;

    const model: TestRunModel = {
        get phase() { return phase; },
        get digger() { return digger; },

        update(deltaMs) {
            phaseMs += deltaMs;
            if (phase === 'acting') {
                digger.update(deltaMs);
                if (phaseMs >= runMs) {
                    phase = 'asserting';
                    phaseMs = 0;
                }
            }
            else if (phaseMs >= ASSERT_MS) {
                digger = startRun();
                phase = 'acting';
                phaseMs = 0;
            }
        },
    };

    return model;
}
