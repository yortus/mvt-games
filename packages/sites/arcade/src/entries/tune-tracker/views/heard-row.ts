import type { Audio90, Audio90Song, MusicPlayer } from '@mvtjs/chiptune';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The row of the song that the listener hears now. The music player writes
 * each row a little ahead of the sound, by the chip's lead and the sound
 * card's latency, so its own row runs ahead of what is heard. This keeps the
 * last few rows it played, with the chip time each began, and finds the one
 * the sound reaching the speaker has got to. It is the tracker view's view
 * model, and holds presentation state only.
 */
export interface HeardRow {
    /** The entry in the song's order whose row is heard now. 0 when no song is playing. */
    readonly orderIndex: number;
    /** The row heard now, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /**
     * Notes the music player's row, and finds the row heard now. Call it in
     * the view's update step, before the music player is updated, so it sees
     * the row as of the last tick, whose chip time it remembers.
     */
    update: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HeardRowOptions {
    /** The music player whose rows to follow. */
    readonly music: MusicPlayer<Audio90Song>;
    /** The chip the music plays on, whose clocks say where the sound is. */
    readonly chip: Audio90;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a heard row with no song playing. */
export function createHeardRow(options: HeardRowOptions): HeardRow {
    const { music, chip } = options;
    // The rows played lately, round and round: the chip time each began, its entry in the order and its row
    const stamps = new Float64Array(HISTORY_LENGTH);
    const orderIndexes = new Int32Array(HISTORY_LENGTH);
    const rows = new Int32Array(HISTORY_LENGTH);
    let newest = -1;
    let count = 0;
    let lastSong: Audio90Song | undefined;
    // The chip time at the last update, which the music player's row was played by. In a typed array, so
    // writing it every tick boxes no double
    const times = new Float64Array(1);
    let heardOrderIndex = 0;
    let heardRow = 0;

    return {
        get orderIndex() {
            return heardOrderIndex;
        },
        get row() {
            return heardRow;
        },
        update() {
            const song = music.song;
            if (song !== lastSong) {
                // A new song, or none: what was heard of the last one is gone
                lastSong = song;
                count = 0;
            }
            if (song !== undefined && (count === 0 || music.orderIndex !== orderIndexes[newest] || music.row !== rows[newest])) {
                newest = (newest + 1) % HISTORY_LENGTH;
                if (count < HISTORY_LENGTH) count++;
                // The row began during the last tick, by its chip time at the latest
                stamps[newest] = times[0];
                orderIndexes[newest] = music.orderIndex;
                rows[newest] = music.row;
            }
            times[0] = chip.time;
            findHeard();
        },
    };

    /** Finds the newest row that began no later than the chip time heard now. Before the first, it is the song's start. */
    function findHeard(): void {
        heardOrderIndex = 0;
        heardRow = 0;
        const heardTime = chip.heardTime;
        for (let i = 0; i < count; i++) {
            const at = (newest - i + HISTORY_LENGTH) % HISTORY_LENGTH;
            if (stamps[at] <= heardTime) {
                heardOrderIndex = orderIndexes[at];
                heardRow = rows[at];
                return;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many rows it keeps. The tunes' shortest rows last about 60 ms, so these cover nearly two seconds, far more than the sound trails the music player by. */
const HISTORY_LENGTH = 32;
