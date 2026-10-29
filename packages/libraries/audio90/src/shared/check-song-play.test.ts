import { describe, expect, it } from 'vitest';
import { createAudio90Song, createAudio90Sound } from '../audio90';
import { checkSongPlay, DEFAULT_SONG_PLAY } from './check-song-play';
import { HIGHEST_NOTE, LOWEST_NOTE, toNoteNumber } from './notes';

const LEAD = createAudio90Sound({});
const KICK = createAudio90Sound({ note: 'C-2' });

describe('checkSongPlay', () => {
    it('loops until stopped, at the song\'s own pitch, unless told otherwise', () => {
        const song = createSong('| C-4 L');
        expect(checkSongPlay(song, undefined)).toBe(DEFAULT_SONG_PLAY);
        expect(checkSongPlay(song, {})).toEqual({ repeat: Infinity, pitch: 0, fadeMs: 0 });
        expect(checkSongPlay(song, { repeat: 0, pitch: -3, fadeMs: 500 })).toEqual({ repeat: 0, pitch: -3, fadeMs: 500 });
    });

    it('refuses a repeat that is not a whole number, 0 or more, or Infinity', () => {
        const song = createSong('| C-4 L');
        for (const repeat of [-1, 0.5, Number.NaN, -Infinity]) {
            expect(() => checkSongPlay(song, { repeat }), `repeat ${repeat}`).toThrow(`play: repeat must be a whole number, 0 or more, or Infinity; got ${repeat}`);
        }
    });

    it('refuses a fade that is not 0 or more and finite', () => {
        for (const fadeMs of [-1, Number.NaN, Infinity]) {
            expect(() => checkSongPlay(createSong('| C-4 L'), { fadeMs }), `fadeMs ${fadeMs}`).toThrow(`play: fadeMs must be 0 or more, and finite; got ${fadeMs}`);
        }
    });

    it('refuses a pitch that is not a whole number of semitones', () => {
        expect(() => checkSongPlay(createSong('| C-4 L'), { pitch: 0.5 })).toThrow('play: pitch must be a whole number of semitones; got 0.5');
    });

    it('refuses a pitch that takes a note, as its order entry transposes it, out of the chip\'s range', () => {
        const song = createSong('| C-4 L', ['p', 'p+12']);
        const highest = (toNoteNumber('C-4') ?? 0) + 12;
        expect(checkSongPlay(song, { pitch: HIGHEST_NOTE - highest }).pitch).toBe(HIGHEST_NOTE - highest);
        expect(() => checkSongPlay(song, { pitch: HIGHEST_NOTE - highest + 1 })).toThrow(`outside the chip's range (${LOWEST_NOTE} to ${HIGHEST_NOTE})`);
    });

    it('leaves an instrument\'s own note out, since a pitch doesn\'t move it', () => {
        const drums = createSong('| k');
        expect(checkSongPlay(drums, { pitch: HIGHEST_NOTE }).pitch).toBe(HIGHEST_NOTE);
        expect(checkSongPlay(drums, { pitch: -HIGHEST_NOTE }).pitch).toBe(-HIGHEST_NOTE);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSong(pattern: string, order = ['p']) {
    return createAudio90Song({ bpm: 120, instruments: { L: LEAD, k: KICK }, patterns: { p: pattern }, order });
}
