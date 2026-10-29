import { describe, expect, it } from 'vitest';
import { createAudio90Song } from './audio90-song';
import { createAudio90Sound } from './audio90-sound';
import { printAudio90Song } from './print-audio90-song';
import { SONG_FORMAT, SONG_VERSION } from './song-json';
import { SONG_WITH_EVERYTHING } from './song-with-everything.test-support';

describe('printAudio90Song', () => {
    it('prints the options a song was made from, with each pattern and step table as its rows, comments kept', () => {
        const json = JSON.parse(printAudio90Song(SONG_WITH_EVERYTHING)) as Record<string, unknown>;
        expect(json).toMatchObject({ format: SONG_FORMAT, version: SONG_VERSION, bpm: 128, swing: 0.1, character: 'console' });
        expect(json.patterns).toEqual({ a: ['# lead | drum', '| C-4 L v9 | k', '| E-4 >    | h'], b: ['| G-4 L ~ | k'] });
        expect(json).toMatchObject({ instruments: { L: { steps: ['vF', '+12 v8'] }, h: { sample: { rate: 16000, bounce: { bpm: 120 } } } } });
        // A default left out of the options stays out of the text
        expect(json).not.toHaveProperty('rowsPerBeat');
    });

    it('refuses a song this package did not make', () => {
        const options = { bpm: 120, instruments: { L: createAudio90Sound({}) }, patterns: { p: '| C-4 L' }, order: ['p'] };
        const song = createAudio90Song(options);
        const copied = { ...song };
        expect(() => printAudio90Song(copied)).toThrow('song: was not made by createAudio90Song');
    });
});
