import { describe, expect, it } from 'vitest';
import type { Audio80Character } from './audio80';
import { findSounds, hashSamples, measurePeak, render } from './headless';
import * as reference from './reference-sounds.test-support';

// What the chips sound like. Each song and sound in the reference set is
// rendered as a chip would play it, and its samples are hashed. A change to
// a synthesiser, or to how a song is played, that changes the sound fails
// here. If the change was meant, listen to the reference set before and
// after with `npm run render-wav -- src/reference-sounds.test-support.ts`,
// then update the snapshot with `npx vitest run -u`.

const { songs, sounds } = findSounds(reference);
const AUDIO80_CHARACTERS: readonly Audio80Character[] = ['clean', 'classic', 'raw'];

describe('the reference set', () => {
    it('has songs and sounds for both chips', () => {
        const chips = [...songs, ...sounds].map(([, songOrSound]) => songOrSound.chip);
        expect(new Set(chips)).toEqual(new Set(['audio80', 'audio90']));
    });

    for (const [name, sound] of sounds) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = render(sound);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const [name, song] of songs) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = render(song);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const character of AUDIO80_CHARACTERS) {
        it(`AUDIO80_SONG sounds as it did in the ${character} character`, () => {
            expect(hashSamples(render(reference.AUDIO80_SONG, { character }))).toMatchSnapshot();
        });
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quieter than this, a part of the chip could be silent by mistake and still pass. */
const AUDIBLE = 0.02;
/** The output rounds off loud levels, so a peak above this one has been rounded off hard. */
const CLIPPING = 0.9;
