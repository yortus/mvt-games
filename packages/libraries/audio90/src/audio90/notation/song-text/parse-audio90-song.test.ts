import { describe, expect, it } from 'vitest';
import { createAudio90Sample } from '../audio90-sample';
import { createAudio90Song } from '../audio90-song';
import { createAudio90Sound } from '../audio90-sound';
import { parseAudio90Song } from './parse-audio90-song';
import { printAudio90Song } from './print-audio90-song';
import { SONG_FORMAT, SONG_VERSION } from './song-json';
import { FM_NOTE_SONG, SONG_WITH_EVERYTHING } from './song-with-everything.test-support';

describe('parseAudio90Song', () => {
    it('reads a printed song back into the same song, with every engine, a sample, a step table and the mix', () => {
        const parsed = parseAudio90Song(printAudio90Song(SONG_WITH_EVERYTHING));
        expect(parsed).toEqual(SONG_WITH_EVERYTHING);
        expect(printAudio90Song(parsed)).toBe(printAudio90Song(SONG_WITH_EVERYTHING));
    });

    it('takes a pattern as one string, as createAudio90Song does', () => {
        const text = JSON.stringify({ format: SONG_FORMAT, version: SONG_VERSION, bpm: 120, instruments: { L: {} }, patterns: { p: '| C-4 L\n| ===' }, order: ['p'] });
        const song = parseAudio90Song(text);
        expect(song.patterns[0].rowCount).toBe(2);
    });

    it('makes one sample that two instruments share, so it is bounced and kept once', () => {
        const sample = createAudio90Sample({ bounce: FM_NOTE_SONG, rate: 16000 });
        const song = createAudio90Song({
            bpm: 120,
            instruments: { a: createAudio90Sound({ engine: 'sample', sample }), b: createAudio90Sound({ engine: 'sample', sample, volume: 0.5 }) },
            patterns: { p: '| C-4 a | C-4 b' },
            order: ['p'],
        });
        const [a, b] = parseAudio90Song(printAudio90Song(song)).instruments;
        expect(a.sample).toBe(b.sample);
    });

    it('refuses text that is not an Audio90 song, or not a version this package reads', () => {
        const head = `"format": "${SONG_FORMAT}"`;
        expect(() => parseAudio90Song('{')).toThrow('song text: not JSON');
        expect(() => parseAudio90Song('{ "bpm": 120 }')).toThrow(`song text: not an Audio90 song, whose format is "${SONG_FORMAT}"`);
        expect(() => parseAudio90Song(`{ ${head}, "version": ${SONG_VERSION + 1} }`)).toThrow(`song text: version ${SONG_VERSION + 1} is not one this package reads, which is ${SONG_VERSION}`);
        expect(() => parseAudio90Song(`{ ${head}, "version": ${SONG_VERSION}, "bpm": 120, "patterns": {} }`)).toThrow('song text: instruments: must be an object');
    });
});
