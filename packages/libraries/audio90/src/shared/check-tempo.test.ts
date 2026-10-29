import { describe, expect, it } from 'vitest';
import { checkTempo } from './check-tempo';

describe('checkTempo', () => {
    it('fills in a tempo\'s defaults, and refuses a tempo out of range', () => {
        expect(checkTempo({ bpm: 120 })).toEqual({ rowsPerBeat: 4, swing: 0 });
        expect(() => checkTempo({ bpm: 0 })).toThrow('song: bpm must be above 0; got 0');
        expect(() => checkTempo({ bpm: 120, swing: 0.6 })).toThrow(/swing/);
    });
});
