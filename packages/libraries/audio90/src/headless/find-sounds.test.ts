import { describe, expect, it } from 'vitest';
import { createAudio90Sound } from '../audio90';
import { findSounds } from './find-sounds';

describe('findSounds', () => {
    const zap = createAudio90Sound({ oscillator: { wave: 'saw' }, note: 'C-5', lengthMs: 100 });

    it('finds each exported sound, by its export name, and skips what is not a sound', () => {
        const { songs, sounds } = findSounds({ ZAP: zap, SPEED: 3, LABEL: 'zap' });
        expect(sounds).toEqual([['ZAP', zap]]);
        expect(songs).toEqual([]);
    });

    it('finds the sounds in an exported array, each named for its place', () => {
        const { sounds } = findSounds({ FANFARES: [zap, undefined, zap], SPEEDS: [1, 2] });
        expect(sounds).toEqual([['FANFARES[0]', zap], ['FANFARES[2]', zap]]);
    });
});
