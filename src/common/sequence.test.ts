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
        it('is not active before start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            expect(seq.isActive).toBe(false);
        });

        it('all steps have progress 0 and are inactive before start', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            expect(seq.steps.a.progress).toBe(0);
            expect(seq.steps.a.isActive).toBe(false);
            expect(seq.steps.b.progress).toBe(0);
            expect(seq.steps.b.isActive).toBe(false);
        });

        it('computes durationMs from the latest-ending step', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            expect(seq.durationMs).toBe(250);
        });

        it('overall progress is 0 before start', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            expect(seq.progress).toBe(0);
        });
    });

    describe('running', () => {
        it('is active after start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            expect(seq.isActive).toBe(true);
        });

        it('stops being active after all steps complete', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.isActive).toBe(false);
        });

        it('stays active while a delayed step has not started', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 50 },
                { name: 'b', startMs: 100, durationMs: 50 },
            ]);
            seq.start();
            stepMs(seq, 60);
            // Step 'a' is done, step 'b' hasn't started yet
            expect(seq.steps.a.progress).toBe(1);
            expect(seq.steps.b.isActive).toBe(false);
            expect(seq.isActive).toBe(true);
        });

        it('overall progress advances linearly with elapsed time', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 200 },
            ]);
            seq.start();
            seq.update(100);
            expect(seq.progress).toBeCloseTo(0.5, 2);
        });

        it('overall progress reaches 1 when complete', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.progress).toBe(1);
        });
    });

    describe('step progress', () => {
        it('progress is 0 before the step starts', () => {
            const seq = createSequence([
                { name: 'a', startMs: 100, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 50);
            expect(seq.steps.a.progress).toBe(0);
            expect(seq.steps.a.isActive).toBe(false);
        });

        it('progress advances linearly during the step', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            seq.update(50);
            expect(seq.steps.a.progress).toBeCloseTo(0.5, 2);
            expect(seq.steps.a.isActive).toBe(true);
        });

        it('progress reaches 1 when the step completes', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.steps.a.progress).toBe(1);
            expect(seq.steps.a.isActive).toBe(false);
        });

        it('progress does not exceed 1', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.start();
            stepMs(seq, 200);
            expect(seq.steps.a.progress).toBe(1);
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
            expect(seq.steps.a.isActive).toBe(true);
            expect(seq.steps.b.isActive).toBe(true);
        });

        it('earlier step completes while later step is still active', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
                { name: 'b', startMs: 50, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 120);
            expect(seq.steps.a.progress).toBe(1);
            expect(seq.steps.a.isActive).toBe(false);
            expect(seq.steps.b.isActive).toBe(true);
        });
    });

    describe('steps lookup', () => {
        it('provides named access to each step', () => {
            const seq = createSequence([
                { name: 'fade', startMs: 0, durationMs: 100 },
                { name: 'shake', startMs: 50, durationMs: 100 },
            ]);
            seq.start();
            seq.update(50);
            expect(seq.steps.fade.progress).toBeGreaterThan(0);
            expect(seq.steps.shake.progress).toBe(0);
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
            expect(seq.steps.a.progress).toBe(1);

            seq.start();
            expect(seq.steps.a.progress).toBe(0);
            expect(seq.steps.b.progress).toBe(0);
            expect(seq.isActive).toBe(true);
        });

        it('can be restarted mid-sequence', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 200 },
            ]);
            seq.start();
            stepMs(seq, 100);
            expect(seq.steps.a.isActive).toBe(true);

            seq.start();
            expect(seq.steps.a.progress).toBe(0);
            expect(seq.steps.a.isActive).toBe(false);
        });
    });

    describe('empty sequence', () => {
        it('handles zero steps gracefully', () => {
            const seq = createSequence([]);
            expect(seq.durationMs).toBe(0);
            expect(seq.isActive).toBe(false);
            seq.start();
            seq.update(16);
            expect(seq.isActive).toBe(false);
        });
    });

    describe('no-op when not active', () => {
        it('update() does nothing before start()', () => {
            const seq = createSequence([
                { name: 'a', startMs: 0, durationMs: 100 },
            ]);
            seq.update(1000);
            expect(seq.steps.a.progress).toBe(0);
            expect(seq.isActive).toBe(false);
        });
    });
});
