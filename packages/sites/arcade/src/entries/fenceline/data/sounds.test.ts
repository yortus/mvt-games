import { describe, expect, it } from 'vitest';
import { findSounds } from 'audio90/headless';
import * as music from './music';
import * as sounds from './sounds';

// Importing the data parses its notation, so a mistake in a pattern or a step
// table fails here. How the sounds sound is checked by ear: `npm run
// audio:render` renders them to WAV files, and prints each one's peak, and
// each song's loudness beside the loudness every song shares.

describe('fenceline sounds', () => {
    it('parses its songs and sounds', () => {
        const { songs, sounds: found } = findSounds({ ...music, ...sounds });
        expect(found.length).toBeGreaterThan(0);
        expect(songs.length).toBeGreaterThan(0);
    });
});
