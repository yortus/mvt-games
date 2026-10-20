import { describe, expect, it } from 'vitest';
import { type Audio90, createAudio90Instrument, createAudio90Song, createMusicPlayer } from '@mvtjs/chiptune';
import { createHeadlessAudio90 } from '@mvtjs/chiptune/headless';
import { createHeardRow } from './heard-row';

const TICK_MS = 1000 / 60;
const BPM = 120;
const ROWS_PER_BEAT = 4;
const ROW_MS = 60000 / (BPM * ROWS_PER_BEAT);
const PATTERN_ROWS = 16;
/** How far the sound at the speaker trails the chip's time, as the lead and the sound card's latency make it. */
const LAG_MS = 300;

describe('heard row', () => {
    it('shows the song\'s start until the sound reaches the song', () => {
        const { heard, music, tick } = setUp();
        tick(LAG_MS - 2 * TICK_MS);
        expect([heard.orderIndex, heard.row]).toEqual([0, 0]);
        expect(music.row).toBeGreaterThan(0);
    });

    it('shows the row the sound has reached, which trails the music player\'s row', () => {
        const { heard, music, tick } = setUp();
        // 63 ticks, which end part way through a row
        const playedMs = 63 * TICK_MS;
        tick(playedMs);
        expect(music.row).toBe(Math.floor(playedMs / ROW_MS));
        // A row is noted by the chip time of the tick it began in, so it shows up to a tick late
        const heardMs = playedMs - LAG_MS - TICK_MS;
        expect(heard.row).toBe(Math.floor(heardMs / ROW_MS));
        expect(heard.row).toBeLessThan(music.row);
    });

    it('follows the song into its next pattern, and back round its loop', () => {
        const { heard, tick } = setUp();
        const patternMs = PATTERN_ROWS * ROW_MS;
        tick(LAG_MS + patternMs + ROW_MS * 2.5);
        expect([heard.orderIndex, heard.row]).toEqual([1, 2]);
        tick(patternMs);
        // The order is two patterns long, and loops back to its start
        expect([heard.orderIndex, heard.row]).toEqual([0, 2]);
    });

    it('goes back to the start once the music stops', () => {
        const { heard, music, tick } = setUp();
        tick(1000);
        music.stop();
        tick(TICK_MS);
        expect([heard.orderIndex, heard.row]).toEqual([0, 0]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plays the song on a headless chip whose sound is heard `LAG_MS` after its time, and returns how to tick it. */
function setUp() {
    const { audio90, controls } = createHeadlessAudio90();
    // The chip as the heard row sees it: its own clock, with the sound trailing it
    const chip = Object.create(audio90, { heardTime: { get: () => audio90.time - LAG_MS } }) as Audio90;
    const music = createMusicPlayer({ audio90 });
    const heard = createHeardRow({ music, chip });
    music.play(SONG);
    /** Runs ticks for `ms`, in the order the game loop runs them: the clock, then the views. */
    const tick = (ms: number) => {
        for (let elapsed = 0; elapsed < ms - 1e-9; elapsed += TICK_MS) {
            controls.update(TICK_MS);
            heard.update();
            music.update(TICK_MS);
            music.refresh();
            controls.flush();
        }
    };
    return { heard, music, tick };
}

const SONG = createAudio90Song({
    bpm: BPM,
    rowsPerBeat: ROWS_PER_BEAT,
    instruments: { L: createAudio90Instrument({ oscillator: { wave: 'saw' } }) },
    patterns: {
        a: ['| C-4 L', ...new Array<string>(PATTERN_ROWS - 1).fill('| ...')].join('\n'),
        b: ['| E-4 L', ...new Array<string>(PATTERN_ROWS - 1).fill('| ...')].join('\n'),
    },
    order: ['a', 'b'],
    loop: 0,
});
