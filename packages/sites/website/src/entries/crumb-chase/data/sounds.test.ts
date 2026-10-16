import { describe, expect, it } from 'vitest';
import { createHeadlessAudio80, hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, renderSoundEffect, renderSong, findSounds } from '@mvtjs/audio/headless';
import * as music from './music';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. Each effect and song is then rendered as the chip would
// play it, and its samples are hashed. A change to the chip or to the data
// that changes a sound makes that sound's test fail. Listen to the new sound
// first, with `npm run audio:render`. Then update the snapshot with
// `vitest -u`.

const { songs, effects } = findSounds({ ...sounds, ...music });

describe('crumb chase sounds', () => {
    it('has effects and songs to test', () => {
        expect(effects.length).toBeGreaterThan(0);
        expect(songs.length).toBeGreaterThan(0);
    });

    for (const [name, effect] of effects) {
        it(`${name} sounds as it did, audible and unclipped`, () => {
            const samples = renderSoundEffect(effect);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    for (const [name, song] of songs) {
        it(`${name} sounds as it did, audible and unclipped, as loud as every other song`, () => {
            const samples = renderSong(song);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            expect(Math.abs(measureLoudness(samples) - REFERENCE_LOUDNESS_LUFS)).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    it('leaves the effects six voices', () => {
        const { voiceCount } = createHeadlessAudio80().audio80;
        for (const [, song] of songs) expect(voiceCount - song.channelCount).toBeGreaterThanOrEqual(EFFECT_VOICES);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many of the chip's voices the music must leave free for the sound effects. */
const EFFECT_VOICES = 6;
/** Quieter than this, a sound is lost under the music. */
const AUDIBLE = 0.08;
/**
 * The peak at which a sound counts as clipped. The output rounds off loud
 * levels, so a peak never reaches 1, and a peak above this one has been
 * rounded off hard. This is a limit to stay under, not a peak to aim for.
 * An effect should peak at about 0.08 to 0.3.
 */
const CLIPPING = 0.9;
