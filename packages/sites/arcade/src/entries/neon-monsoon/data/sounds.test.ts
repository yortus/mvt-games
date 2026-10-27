import { describe, expect, it } from 'vitest';
import { AUDIO90_VOICE_COUNT, prepareAudio90Samples } from 'audio90';
import { findSounds, hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, render } from 'audio90/headless';
import { SAMPLES } from './instruments';
import * as music from './music';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. Each effect and song is then rendered as the chip would
// play it, and its samples are hashed. A change to the chip or to the data
// that changes a sound makes that sound's test fail. Listen to the new sound
// first, with `npm run audio:render`. Then update the snapshot with
// `vitest -u`.

const { songs, sounds: found } = findSounds({ ...sounds, ...music });
// A song's instruments are sounds too. Each is heard in its song's test, so only the sounds played on their own are tested alone
const instruments = new Set(songs.flatMap(([, song]): readonly unknown[] => song.instruments));
const effects = found.filter(([, sound]) => !instruments.has(sound));
// The orchestra hit is bounced as the game loads, so it is bounced before the sounds are rendered
prepareAudio90Samples(SAMPLES);

describe('neon monsoon sounds', { timeout: 30_000 }, () => {
    it('has effects and songs to test', () => {
        expect(effects.length).toBeGreaterThan(0);
        expect(songs.length).toBeGreaterThan(0);
    });

    for (const [name, effect] of effects) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = render(effect);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const [name, song] of songs) {
        it(`${name} sounds as it did, audible and unclipped, as loud as every other song`, () => {
            const samples = render(song);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(Math.abs(measureLoudness(samples) - REFERENCE_LOUDNESS_LUFS)).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    it('leaves the effects eight voices', () => {
        for (const [, song] of songs) expect(AUDIO90_VOICE_COUNT - song.channelCount).toBeGreaterThanOrEqual(EFFECT_VOICES);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many of the chip's voices the music must leave free for the sound effects. */
const EFFECT_VOICES = 8;
/** Quieter than this, a sound is lost under the music. */
const AUDIBLE = 0.08;
/**
 * The peak at which a sound counts as clipped. The output rounds off loud
 * levels, so a peak never reaches 1, and a peak above this one has been
 * rounded off hard. This is a limit to stay under, not a peak to aim for.
 * An effect's level is set by its loudness, not its peak: a burst of noise,
 * such as an explosion, peaks far above its loudness, so it may peak at 0.7
 * where a tone as loud peaks at 0.3.
 */
const CLIPPING = 0.9;
