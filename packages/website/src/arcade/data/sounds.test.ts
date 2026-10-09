import { describe, expect, it } from 'vitest';
import { computeSongDurationMs } from '@mvtjs/audio';
import { hashSamples, LOUDNESS_TOLERANCE_LU, measureLoudness, measurePeak, REFERENCE_LOUDNESS_LUFS, renderSoundEffect, renderSong, findSounds } from '@mvtjs/audio/headless';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. Each effect and song is then rendered as the chip would
// play it, and its samples are hashed. A change to the chip or to the data
// that changes the sound fails the test. Once someone has listened to the new
// sound (`npm run audio:render`), the snapshot can be updated (`vitest -u`).

const { songs, effects } = findSounds(sounds);

describe('arcade sounds', () => {
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
        // Loudness is averaged over blocks of 400 ms. A song much shorter than that would measure mostly the silence after it.
        const isMeasurable = computeSongDurationMs(song) >= MEASURABLE_MS;
        it(`${name} sounds as it did, audible and unclipped${isMeasurable ? ', as loud as every other song' : ''}`, () => {
            const samples = renderSong(song);
            expect(measurePeak(samples)).toBeGreaterThan(AUDIBLE);
            expect(measurePeak(samples)).toBeLessThan(CLIPPING);
            if (isMeasurable) {
                expect(Math.abs(measureLoudness(samples) - REFERENCE_LOUDNESS_LUFS)).toBeLessThanOrEqual(LOUDNESS_TOLERANCE_LU);
            }
            expect(hashSamples(samples)).toMatchSnapshot();
        });
    }

    it('leaves the effects most of the voices', () => {
        for (const [, song] of songs) expect(song.channelCount).toBeLessThanOrEqual(3);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A sound quieter than this is lost. The floor is lower than a game's, because the Arcade's sounds are its interface and are meant to be small. */
const AUDIBLE = 0.04;
/** A sound louder than this is being squashed by the output stage's soft clip. */
const CLIPPING = 0.9;
/** A song at least this long has a loudness worth measuring. */
const MEASURABLE_MS = 1200;
