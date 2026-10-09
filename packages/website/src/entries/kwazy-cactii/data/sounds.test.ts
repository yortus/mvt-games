import { describe, expect, it } from 'vitest';
import { hashSamples, measurePeak, renderSoundEffect, findSounds } from '@mvtjs/audio/headless';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a step table fails
// here. Each effect is then rendered as the chip would play it, and its
// samples are hashed. A change to the chip or to the data that changes a
// sound makes that sound's test fail. Listen to the new sound first, with
// `npm run audio:render`. Then update the snapshot with `vitest -u`.

const fanfares = Object.fromEntries(sounds.CASCADE_FANFARES.map((fanfare, i) => [`CASCADE_FANFARES[${i}]`, fanfare]));
const { songs, effects } = findSounds({ ...sounds, ...fanfares });

describe('kwazy cactii sounds', () => {
    it('has effects to test, and no music', () => {
        expect(effects.length).toBeGreaterThan(sounds.CASCADE_FANFARES.length);
        expect(songs).toHaveLength(0);
    });

    // The view's tests tell the effects apart by which one is played. This
    // test checks that the player can tell them apart too.
    it('has no two effects that sound the same', () => {
        const hashes = new Set(effects.map(([, effect]) => hashSamples(renderSoundEffect(effect))));
        expect(hashes.size).toBe(effects.length);
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

/** Quieter than this, a sound is lost. */
const AUDIBLE = 0.08;
/**
 * The peak at which a sound counts as clipped. The output rounds off loud
 * levels, so a peak never reaches 1, and a peak above this one has been
 * rounded off hard. This is a limit to stay under, not a peak to aim for.
 * An effect should peak at about 0.08 to 0.3.
 */
const CLIPPING = 0.9;
