import { describe, expect, it } from 'vitest';
import { hashSamples, measurePeak, renderSoundEffect, findSounds } from '@mvtjs/audio/headless';
import * as sounds from './sounds';

// Astrovoid has no music. It has only effects.
//
// Importing the data parses its notation, so a mistake in a step table fails
// here. Each effect is then rendered as the chip would play it, and its
// samples are hashed. A change to the chip or to the data that changes a
// sound makes that sound's test fail. Listen to the new sound first, with
// `npm run audio:render`. Then update the snapshot with `vitest -u`.

const { effects } = findSounds(sounds);

describe('astrovoid sounds', () => {
    it('has effects to test', () => {
        expect(effects.length).toBeGreaterThan(0);
    });

    for (const [name, effect] of effects) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = renderSoundEffect(effect);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quieter than this, a sound is lost under the game's other sounds. */
const AUDIBLE = 0.08;
/**
 * The peak at which a sound counts as clipped. The output rounds off loud
 * levels, so a peak never reaches 1, and a peak above this one has been
 * rounded off hard. This is a limit to stay under, not a peak to aim for.
 * An effect should peak at about 0.08 to 0.3.
 */
const CLIPPING = 0.9;
