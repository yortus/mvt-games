import { describe, expect, it } from 'vitest';
import { createAudio80Song, createAudio80Sound } from '../audio80';
import { createHeadlessAudio80 } from './headless-audio80';

const HELD = createAudio80Sound({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } });

describe('headless Audio80', () => {
    it('takes every play and runs its clock and its song, though it plays nothing', () => {
        const chip = createHeadlessAudio80();
        const song = createAudio80Song({ bpm: 120, instruments: { s: HELD }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'], loop: 0 });
        expect([chip.play(HELD), chip.play(song)]).toEqual([1, 2]);
        // 10 ticks are 167 ms, into the second row, which starts at 125 ms
        for (let i = 0; i < 10; i++) chip.update(1000 / 60);
        expect([chip.song, chip.row]).toEqual([song, 1]);
    });

    it('checks a play\'s options as every chip does', () => {
        expect(() => createHeadlessAudio80().play(HELD, { volume: -1 })).toThrow('play: volume must be 0 or more');
    });
});
