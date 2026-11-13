import { describe, expect, it } from 'vitest';
import { findSounds } from 'audio90/headless';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. How the sounds sound is checked by ear: `npm run
// audio:render` renders them to WAV files, and prints each one's peak, and
// each song's loudness beside the loudness every song shares.

describe('rosette sounds', () => {
    it('parses its sounds', () => {
        const { sounds: found } = findSounds(sounds);
        expect(found.length).toBeGreaterThan(0);
    });
});
