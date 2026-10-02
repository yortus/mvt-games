import { describe, it, expect, vi } from 'vitest';
import { createSequence } from './sequence';
import { createSequenceReaction } from './sequence-reaction';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A simple two-step sequence: 'a' at 0-100ms, 'b' at 50-250ms. */
function twoStepSequence() {
    return createSequence([
        { name: 'a', startMs: 0, durationMs: 100 },
        { name: 'b', startMs: 50, durationMs: 200 },
    ] as const);
}

/** A single-step sequence: 'x' at 0-100ms. */
function singleStepSequence() {
    return createSequence([
        { name: 'x', startMs: 0, durationMs: 100 },
    ] as const);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSequenceReaction', () => {
    describe('initialisation', () => {
        it('fires inactive handler on creation when sequence has not started', () => {
            const seq = singleStepSequence();
            const inactive = vi.fn();
            createSequenceReaction(seq, { x: { inactive } });
            expect(inactive).toHaveBeenCalledOnce();
            expect(inactive).toHaveBeenCalledWith('start');
        });

        it('fires inactive(end) on creation for a step that has already completed', () => {
            const seq = singleStepSequence();
            seq.start();
            seq.update(200);
            const inactive = vi.fn();
            createSequenceReaction(seq, { x: { inactive } });
            expect(inactive).toHaveBeenCalledWith('end');
        });

        it('fires entering then active on creation for a step that is mid-flight', () => {
            const seq = singleStepSequence();
            seq.start();
            seq.update(50);
            const entering = vi.fn();
            const active = vi.fn();
            createSequenceReaction(seq, { x: { entering, active } });
            expect(entering).toHaveBeenCalledOnce();
            expect(active).toHaveBeenCalledOnce();
        });
    });

    describe('active handler', () => {
        it('fires with progress each tick while the step is active', () => {
            const seq = singleStepSequence();
            const active = vi.fn();
            const update = createSequenceReaction(seq, { x: { active } });

            seq.start();
            seq.update(25);
            update();
            expect(active).toHaveBeenCalledWith(seq.steps.x.progress);

            seq.update(25);
            update();
            expect(active).toHaveBeenLastCalledWith(seq.steps.x.progress);
        });

        it('does not fire when the step is inactive', () => {
            const seq = singleStepSequence();
            const active = vi.fn();
            const update = createSequenceReaction(seq, { x: { active } });

            // Step not started yet - update should not fire active
            update();
            expect(active).not.toHaveBeenCalled();
        });
    });

    describe('entering handler', () => {
        it('fires once with at=start when step transitions from before to active', () => {
            const seq = singleStepSequence();
            const entering = vi.fn();
            const update = createSequenceReaction(seq, { x: { entering } });

            seq.start();
            seq.update(10);
            update();
            expect(entering).toHaveBeenCalledOnce();
            expect(entering).toHaveBeenCalledWith('start');
        });

        it('does not fire again while the step remains active', () => {
            const seq = singleStepSequence();
            const entering = vi.fn();
            const update = createSequenceReaction(seq, { x: { entering } });

            seq.start();
            seq.update(10);
            update();
            entering.mockClear();

            seq.update(10);
            update();
            expect(entering).not.toHaveBeenCalled();
        });
    });

    describe('inactive handler', () => {
        it('fires with at=end when step completes', () => {
            const seq = singleStepSequence();
            const inactive = vi.fn();
            const update = createSequenceReaction(seq, { x: { inactive } });
            inactive.mockClear(); // clear initialisation call

            seq.start();
            seq.update(10);
            update(); // entering active
            inactive.mockClear();

            seq.update(200);
            update(); // step completed
            expect(inactive).toHaveBeenCalledOnce();
            expect(inactive).toHaveBeenCalledWith('end');
        });

        it('fires with at=start on initialisation for an unstarted sequence', () => {
            const seq = singleStepSequence();
            const inactive = vi.fn();
            createSequenceReaction(seq, { x: { inactive } });
            expect(inactive).toHaveBeenCalledWith('start');
        });
    });

    describe('full lifecycle', () => {
        it('cycles through inactive(start) -> entering -> active -> inactive(end)', () => {
            const seq = singleStepSequence();
            const log: string[] = [];
            const update = createSequenceReaction(seq, {
                x: {
                    inactive: (at) => log.push(`inactive(${at})`),
                    entering: (at) => log.push(`entering(${at})`),
                    active: (p) => log.push(`active(${p.toFixed(1)})`),
                },
            });

            // Initialisation fires inactive
            expect(log).toEqual(['inactive(start)']);
            log.length = 0;

            // Start and advance into the step
            seq.start();
            seq.update(50);
            update();
            expect(log).toEqual(['entering(start)', 'active(0.5)']);
            log.length = 0;

            // Continue active
            seq.update(25);
            update();
            expect(log).toEqual(['active(0.8)']);
            log.length = 0;

            // Complete
            seq.update(50);
            update();
            expect(log).toEqual(['inactive(end)']);
        });
    });

    describe('multiple steps', () => {
        it('dispatches to the correct step handler independently', () => {
            const seq = twoStepSequence();
            const aLog: string[] = [];
            const bLog: string[] = [];
            const update = createSequenceReaction(seq, {
                a: {
                    inactive: (at) => aLog.push(`inactive(${at})`),
                    entering: () => aLog.push('entering'),
                    active: () => aLog.push('active'),
                },
                b: {
                    inactive: (at) => bLog.push(`inactive(${at})`),
                    entering: () => bLog.push('entering'),
                    active: () => bLog.push('active'),
                },
            });

            // Both initialise to inactive
            expect(aLog).toEqual(['inactive(start)']);
            expect(bLog).toEqual(['inactive(start)']);
            aLog.length = 0;
            bLog.length = 0;

            // At 25ms: 'a' active, 'b' still waiting
            seq.start();
            seq.update(25);
            update();
            expect(aLog).toEqual(['entering', 'active']);
            expect(bLog).toEqual([]);
            aLog.length = 0;

            // At 75ms: 'a' still active, 'b' now entering
            seq.update(50);
            update();
            expect(aLog).toEqual(['active']);
            expect(bLog).toEqual(['entering', 'active']);
        });
    });

    describe('partial handler sets', () => {
        it('works with only an active handler', () => {
            const seq = singleStepSequence();
            const active = vi.fn();
            const update = createSequenceReaction(seq, { x: { active } });

            seq.start();
            seq.update(50);
            update();
            expect(active).toHaveBeenCalledOnce();
        });

        it('works with only an inactive handler', () => {
            const seq = singleStepSequence();
            const inactive = vi.fn();
            const update = createSequenceReaction(seq, { x: { inactive } });

            // Initialisation
            expect(inactive).toHaveBeenCalledOnce();
            inactive.mockClear();

            // Go through active then complete
            seq.start();
            seq.update(10);
            update();
            seq.update(200);
            update();
            expect(inactive).toHaveBeenCalledOnce();
            expect(inactive).toHaveBeenCalledWith('end');
        });

        it('works with an empty handler object', () => {
            const seq = singleStepSequence();
            const update = createSequenceReaction(seq, { x: {} });

            seq.start();
            seq.update(50);
            expect(() => update()).not.toThrow();
        });
    });

    describe('sequence restart', () => {
        it('fires inactive(start) then entering on restart while active', () => {
            const seq = singleStepSequence();
            const log: string[] = [];
            const update = createSequenceReaction(seq, {
                x: {
                    inactive: (at) => log.push(`inactive(${at})`),
                    entering: (at) => log.push(`entering(${at})`),
                    active: () => log.push('active'),
                },
            });
            log.length = 0;

            // First play: enter active
            seq.start();
            seq.update(50);
            update();
            log.length = 0;

            // Restart: step resets to progress=0, inactive
            seq.start();
            update();
            expect(log).toEqual(['inactive(start)']);
            log.length = 0;

            // Advance again into active
            seq.update(10);
            update();
            expect(log).toEqual(['entering(start)', 'active']);
        });

        it('fires inactive(start) on restart after step had completed', () => {
            const seq = singleStepSequence();
            const inactive = vi.fn();
            const update = createSequenceReaction(seq, { x: { inactive } });
            inactive.mockClear();

            seq.start();
            seq.update(10);
            update();
            seq.update(200);
            update();
            // inactive(end) was called
            inactive.mockClear();

            // Restart
            seq.start();
            update();
            expect(inactive).toHaveBeenCalledWith('start');
        });
    });

    describe('no-op when idle', () => {
        it('does not fire handlers when update is called on an unstarted sequence', () => {
            const seq = singleStepSequence();
            const active = vi.fn();
            const entering = vi.fn();
            const inactive = vi.fn();
            const update = createSequenceReaction(seq, { x: { active, entering, inactive } });
            inactive.mockClear(); // clear init

            update();
            update();
            expect(active).not.toHaveBeenCalled();
            expect(entering).not.toHaveBeenCalled();
            expect(inactive).not.toHaveBeenCalled();
        });
    });
});
