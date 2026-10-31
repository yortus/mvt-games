import { describe, expect, it } from 'vitest';
import { findSounds, hashSamples, measureLoudness, measurePeak, render } from 'audio90/headless';
import * as sounds from './sounds';

// Each effect is rendered as the chip would play it, and its samples are
// hashed. A change to the chip or to a sound that changes how it sounds
// makes that sound's test fail. Listen to the new sound first, with
// `npm run audio:render`. Then update the snapshot with `vitest -u`.

const { sounds: effects } = findSounds(sounds);

describe('sudoku sounds', { timeout: 30_000 }, () => {
    it('has effects to test', () => {
        expect(effects.length).toBeGreaterThan(0);
    });

    for (const [name, effect] of effects) {
        it(`${name} sounds as it did, audible, unclipped and soft`, () => {
            const samples = render(effect);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(measureLoudness(samples)).toBeLessThan(LOUDEST_LUFS);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quieter than this, a sound is lost. */
const AUDIBLE = 0.08;
/** The peak at which a sound counts as clipped. The output rounds off loud levels, so this is a limit to stay under. */
const CLIPPING = 0.9;
/**
 * A puzzle is played in quiet, so every effect is quieter than a song,
 * which plays at -20 LUFS. The solved chime sits near -24, a digit written
 * in near -28, and the ticks quieter still.
 */
const LOUDEST_LUFS = -23;
