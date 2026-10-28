import { describe, expect, it } from 'vitest';
import { createAudio90Song, createAudio90Sound, HELD_ENVELOPE } from '../audio90';
import { createHeadlessAudio90 } from './headless-audio90';

const HELD = createAudio90Sound({ oscillator: { wave: 'saw' }, envelope: HELD_ENVELOPE });

describe('headless Audio90', () => {
    it('takes every play and runs its clock and its song, though it plays nothing', () => {
        const chip = createHeadlessAudio90();
        const song = createAudio90Song({ bpm: 120, instruments: { s: HELD }, patterns: { p: '| C-4 s\n| D-4 s' }, order: ['p'], loop: 0 });
        expect([chip.play(HELD, { pan: 1 }), chip.play(song)]).toEqual([1, 2]);
        // 10 ticks are 167 ms, into the second row, which starts at 125 ms
        for (let i = 0; i < 10; i++) chip.update(1000 / 60);
        expect([chip.song, chip.row]).toEqual([song, 1]);
    });
});
