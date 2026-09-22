import { describe, it, expect, vi } from 'vitest';
import { derive } from './derive';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('derive', () => {
    describe('first poll', () => {
        it('runs compute once with previous === initial', () => {
            const initial = { n: 0 };
            const compute = vi.fn((prev: { n: number }) => {
                prev.n = 42;
                return prev;
            });
            const d = derive({ watch: { k: () => 1 }, initial, compute });

            const value = d.poll();

            expect(compute).toHaveBeenCalledTimes(1);
            expect(compute.mock.calls[0][0]).toBe(initial);
            expect(value).toEqual({ n: 42 });
            expect(d.changed).toBe(true);
        });

        it('reports changed on the first poll even when the trigger is falsy', () => {
            const d = derive({ watch: { flag: () => false }, initial: 'x', compute: () => 'y' });
            expect(d.poll()).toBe('y');
            expect(d.changed).toBe(true);
        });
    });

    describe('gating', () => {
        it('does not recompute while no trigger changes', () => {
            let source = 5;
            const compute = vi.fn((_prev: number, w: { n: { value: number } }) => w.n.value * 2);
            const d = derive({ watch: { n: () => source }, initial: 0, compute });

            expect(d.poll()).toBe(10);   // first poll computes
            expect(d.poll()).toBe(10);   // unchanged - cached
            expect(d.poll()).toBe(10);

            expect(compute).toHaveBeenCalledTimes(1);
            expect(d.changed).toBe(false);

            source = 7;
            expect(d.poll()).toBe(14);   // trigger changed - recomputes
            expect(compute).toHaveBeenCalledTimes(2);
            expect(d.changed).toBe(true);
        });

        it('recomputes when any one of several triggers changes', () => {
            const a = 1;
            let b = 1;
            const compute = vi.fn((_prev: number) => a + b);
            const d = derive({ watch: { a: () => a, b: () => b }, initial: 0, compute });

            d.poll();                    // 1
            expect(compute).toHaveBeenCalledTimes(1);

            b = 2;
            expect(d.poll()).toBe(3);
            expect(compute).toHaveBeenCalledTimes(2);
        });

        it('is idempotent within a frame (multiple polls, stable sources)', () => {
            let source = 3;
            const compute = vi.fn((_prev: number) => source * source);
            const d = derive({ watch: { n: () => source }, initial: 0, compute });

            source = 4;
            expect(d.poll()).toBe(16);
            expect(d.poll()).toBe(16);   // second poll same frame - no recompute
            expect(compute).toHaveBeenCalledTimes(1);
            expect(d.changed).toBe(false);
        });
    });

    describe('compute input', () => {
        it('passes the previous value and the watched readings', () => {
            let n = 2;
            const seen: number[] = [];
            const d = derive({
                watch: { n: () => n },
                initial: 100,
                compute: (previous, watched) => {
                    seen.push(previous, watched.n.value, watched.n.previous ?? -1);
                    return watched.n.value;
                },
            });

            d.poll();                    // previous=100, value=2, previous-reading=undefined -> -1
            n = 9;
            d.poll();                    // previous=2, value=9, previous-reading=2

            expect(seen).toEqual([100, 2, -1, 2, 9, 2]);
        });
    });

    describe('in-place vs fresh', () => {
        it('supports in-place mutation returning the same reference', () => {
            let rev = 0;
            const buffer = [0, 0, 0];
            const d = derive({
                watch: { rev: () => rev },
                initial: buffer,
                compute: (buf) => {
                    for (let i = 0; i < buf.length; i++) buf[i] = rev;
                    return buf;
                },
            });

            const first = d.poll();
            expect(first).toBe(buffer);
            rev = 1;
            const second = d.poll();
            expect(second).toBe(buffer);
            expect(buffer).toEqual([1, 1, 1]);
        });

        it('supports returning a fresh value', () => {
            let size = 2;
            const d = derive({
                watch: { size: () => size },
                initial: new Uint8Array(0),
                compute: (prev, w) =>
                    prev.length === w.size.value ? prev : new Uint8Array(w.size.value),
            });

            const first = d.poll();
            expect(first.length).toBe(2);
            size = 4;
            const second = d.poll();
            expect(second.length).toBe(4);
            expect(second).not.toBe(first);
        });
    });
});
