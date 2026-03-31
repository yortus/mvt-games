import { describe, it, expect } from 'vitest';
import { createSequence } from './sequence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepMs(seq: { update(deltaMs: number): void }, totalMs: number): void {
    const step = 16;
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        seq.update(dt);
        remaining -= dt;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSequence', () => {
    describe('initial state', () => {
        it('is not running before start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            expect(seq.isRunning).toBe(false);
        });

        it('all steps have progress 0 and are inactive before start', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            for (let i = 0; i < seq.steps.length; i++) {
                expect(seq.steps[i].progress).toBe(0);
                expect(seq.steps[i].active).toBe(false);
            }
        });

        it('computes totalMs from the latest-ending step', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            expect(seq.totalMs).toBe(250);
        });
    });

    describe('running', () => {
        it('is running after start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            expect(seq.isRunning).toBe(true);
        });

        it('stops running after all steps complete', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.isRunning).toBe(false);
        });

        it('stays running while a delayed step has not started', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 50 },
                { name: 'b', startMs: 100, durationMs: 50 },
            ]);
            seq.start();
            stepMs(seq, 60);
            // Step 'a' is done, step 'b' hasn't started yet
            expect(seq.step('a').progress).toBe(1);
            expect(seq.step('b').active).toBe(false);
            expect(seq.isRunning).toBe(true);
        });
    });

    describe('step progress', () => {
        it('progress is 0 before the step starts', () => {
            const seq = createSequence([
                { name: 'a', startMs: 100, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 50);
            expect(seq.step('a').progress).toBe(0);
            expect(seq.step('a').active).toBe(false);
        });

        it('progress advances linearly during the step', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            seq.update(50);
            expect(seq.step('a').progress).toBeCloseTo(0.5, 2);
            expect(seq.step('a').active).toBe(true);
        });

        it('progress reaches 1 when the step completes', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.step('a').progress).toBe(1);
            expect(seq.step('a').active).toBe(false);
        });

        it('progress does not exceed 1', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 200);
            expect(seq.step('a').progress).toBe(1);
        });
    });

    describe('overlapping steps', () => {
        it('multiple steps can be active simultaneously', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 200 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.step('a').active).toBe(true);
            expect(seq.step('b').active).toBe(true);
        });

        it('earlier step completes while later step is still active', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 120);
            expect(seq.step('a').progress).toBe(1);
            expect(seq.step('a').active).toBe(false);
            expect(seq.step('b').active).toBe(true);
        });
    });

    describe('step() lookup', () => {
        it('returns the correct step by name', () => {
            const seq = createSequence([
                { name: 'fade', startMs: 0, durationMs: 100 },
                { name: 'shake', startMs: 50, durationMs: 100 },
            ]);
            expect(seq.step('fade').name).toBe('fade');
            expect(seq.step('shake').name).toBe('shake');
        });

        it('returns inactive sentinel for unknown names', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            const unknown = seq.step('nonexistent');
            expect(unknown.progress).toBe(0);
            expect(unknown.active).toBe(false);
        });
    });

    describe('start() reset', () => {
        it('resets progress to 0 for all steps', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 0, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 150);
            expect(seq.step('a').progress).toBe(1);

            seq.start();
            expect(seq.step('a').progress).toBe(0);
            expect(seq.step('b').progress).toBe(0);
            expect(seq.isRunning).toBe(true);
        });

        it('can be restarted mid-sequence', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.step('a').active).toBe(true);

            seq.start();
            expect(seq.step('a').progress).toBe(0);
            expect(seq.step('a').active).toBe(false);
        });
    });

    describe('empty sequence', () => {
        it('handles zero steps gracefully', () => {
            const seq = createSequence([]);
            expect(seq.totalMs).toBe(0);
            expect(seq.steps.length).toBe(0);
            expect(seq.isRunning).toBe(false);
            seq.start();
            seq.update(16);
            expect(seq.isRunning).toBe(false);
        });
    });

    describe('no-op when not running', () => {
        it('update() does nothing before start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.update(1000);
            expect(seq.step('a').progress).toBe(0);
            expect(seq.isRunning).toBe(false);
        });
    });
});
