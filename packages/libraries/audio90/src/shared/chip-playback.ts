import type { SongSequencer, SoundChip } from './sound-chip';
import type { SongTiming } from './tracker';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The members of a chip that play songs and sounds, which every chip makes the same way. */
export type ChipPlayback<Song, Sound, PlayOptions> = Pick<
    SoundChip<Song, Sound, PlayOptions>,
    'play' | 'queue' | 'stop' | 'song' | 'orderIndex' | 'row' | 'beat' | 'tempoScale'
>;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a chip's playing members pass their work to. */
export interface ChipPlaybackOptions<Song, Sound, PlayOptions> {
    /** What plays the chip's songs. */
    readonly songs: SongSequencer<Song>;
    /** Plays a sound, and returns the play's id. */
    readonly playSound: (sound: Sound, options: PlayOptions | undefined) => number;
    /** Stops the play of a sound with id `id`. */
    readonly stopSound: (id: number) => void;
    /** Numbers a play of a song, from the same count as the plays of sounds, so no two plays share an id. */
    readonly takePlayId: () => number;
    /** Stops every voice's note, once the song has stopped, as `stop` with no id says. */
    readonly stopVoices: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a chip's playing members, with no song playing, at a tempo scale
 * of 1. `play` tells a song from a sound by its order of patterns, which a
 * sound has none of.
 */
export function createChipPlayback<Song extends SongTiming, Sound extends object, PlayOptions>(
    options: ChipPlaybackOptions<Song, Sound, PlayOptions>,
): ChipPlayback<Song, Sound, PlayOptions> {
    const { songs, playSound, stopSound, takePlayId, stopVoices } = options;
    // The id of the play the song asked for belongs to, which `stop` takes
    let songPlayId = NO_SONG_PLAY;
    let tempoScale = 1;

    return {
        get song() {
            return songs.song;
        },
        get orderIndex() {
            return songs.orderIndex;
        },
        get row() {
            return songs.row;
        },
        get beat() {
            return songs.beat;
        },
        get tempoScale() {
            return tempoScale;
        },
        set tempoScale(value) {
            const scale = Number.isFinite(value) && value > 0 ? value : 0;
            // A view may set it every refresh, so only a change is sent
            if (scale === tempoScale) return;
            tempoScale = scale;
            songs.setTempoScale(scale);
        },

        play(target: Song | Sound, playOptions?: PlayOptions) {
            if (!isSong(target)) return playSound(target, playOptions);
            songPlayId = takePlayId();
            songs.play(target);
            return songPlayId;
        },

        queue(song) {
            // With nothing playing, a queued song starts at once, as a play of its own
            if (songs.song === undefined) songPlayId = takePlayId();
            songs.queue(song);
            return songPlayId;
        },

        stop(id) {
            if (id === undefined) {
                songPlayId = NO_SONG_PLAY;
                songs.stop();
                stopVoices();
            }
            else if (id === songPlayId && id !== NO_SONG_PLAY) {
                songPlayId = NO_SONG_PLAY;
                songs.stop();
            }
            else {
                stopSound(id);
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The song's play id while no song has been asked for. Plays are numbered from 1, so no play has it. */
const NO_SONG_PLAY = 0;

/** Whether `value` is a song rather than a sound. A song has an order of patterns, and a sound has none. */
function isSong<Song extends SongTiming>(value: Song | object): value is Song {
    return 'order' in value;
}
