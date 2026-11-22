import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/utils';
import { ParticlesView, type ParticlesViewBindings } from './particles-view';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParticlesView', () => {
    it('puts particles in the same places for the same seed and steps, and elsewhere for another seed', () => {
        const first = runFor({ seed: 7 }, 30);
        const again = runFor({ seed: 7 }, 30);
        const other = runFor({ seed: 8 }, 30);

        expect(again).toEqual(first);
        expect(other).not.toEqual(first);
    });

    it('leaves every particle where it is on a step of 0', () => {
        const system = ParticlesView({ options: OPTIONS });
        refreshView(system);
        updateView(system, 100);
        const before = Array.from(system.data.f32);

        updateView(system, 0);

        expect(Array.from(system.data.f32)).toEqual(before);
    });

    it('spawns a burst on each rise of the count, but not for the count it first reads', () => {
        let explosions = 3;
        const system = ParticlesView({ options: { ...OPTIONS, emitRate: 0 }, isEmitting: false, bursts: () => explosions, burstSize: 5 });

        refreshView(system);
        const atFirst = liveCount(system.data.f32);
        explosions = 4;
        refreshView(system);
        refreshView(system);

        expect(atFirst).toBe(0);
        expect(liveCount(system.data.f32)).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Each option is a range, so every particle draws random numbers
const OPTIONS = { capacity: 64, emitRate: 40, life: [1, 3], speed: [1, 5], size: [0.1, 0.5] } as const;

/** Returns the particle data after `frames` frames of 1/60 s, with the system emitting. */
function runFor(bindings: ParticlesViewBindings, frames: number): number[] {
    const system = ParticlesView({ options: OPTIONS, ...bindings });
    for (let i = 0; i < frames; i++) {
        updateView(system, 1000 / 60);
        refreshView(system);
    }
    return Array.from(system.data.f32);
}

/** Counts the particle slots whose packed data isn't all zeros. */
function liveCount(f32: Float32Array): number {
    // Each slot holds a particle's four vertices, and an unused slot is all zeros
    const stride = f32.length / 64;
    let count = 0;
    for (let slot = 0; slot < 64; slot++) {
        for (let i = 0; i < stride; i++) {
            if (f32[slot * stride + i] !== 0) {
                count++;
                break;
            }
        }
    }
    return count;
}
