import { describe, expect, it } from 'vitest';
import { createAudio80Sound } from '../../audio80';
import { createAudio90Sound } from '../../audio90';
import { measurePeak } from '../rendered-samples';
import { render } from './render';

/** An envelope that holds its note at full level, and stops quickly once released. */
const HELD_ENVELOPE = { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 };

describe('render', () => {
    for (const tickMs of [0, -1, NaN]) {
        it(`refuses a tick of ${tickMs} ms, which would never reach the end`, () => {
            expect(() => render(createAudio80Sound({}), { tickMs })).toThrow('render: tickMs must be above 0');
        });
    }

    it('renders an Audio90 sound in two channels, at its own pan', () => {
        const zap = createAudio90Sound({ oscillator: { wave: 'saw' }, envelope: HELD_ENVELOPE, note: 'C-5', lengthMs: 100, pan: -1 });
        const { left, right } = render(zap, { durationMs: 200 });
        expect(left.length).toBe(9600);
        expect(measurePeak(left)).toBeGreaterThan(0.05);
        expect(measurePeak(right)).toBeLessThan(1e-6);
    });
});
