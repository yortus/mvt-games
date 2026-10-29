// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Which sound each of a synthesiser's voices was played with, and which play
 * it is, for the sounds played on their own rather than by a song. It
 * chooses a voice for each play, and stops a play by its id.
 */
export interface SoundPlays extends SoundVoices {
    /** The id of the play each voice plays, or -1 for none. */
    readonly playId: Float64Array;
    /** Picks the voice for a play of sound `id`, as `chooseSoundVoice` does, or returns -1 to play nothing. */
    choose: (id: number, priority: number, maxVoices: number) => number;
    /** Marks voice `v`'s new note as no play's, started at sample `at` since the chip started. A play then claims it. */
    startNote: (v: number, at: number) => void;
    /** Marks voice `v`'s note as play `play` of sound `id`. */
    claim: (v: number, id: number, priority: number, play: number) => void;
    /** Releases the note of play `play`, if a voice still plays it. */
    stop: (play: number) => void;
    /** The id of the sound voice `v` was played with, if it is still sounding, or undefined. */
    findSoundOn: (v: number) => number | undefined;
    /** Forgets every voice's play. */
    reset: () => void;
}

/** What the voice chooser reads about the chip's voices. Each array has one slot per voice. */
export interface SoundVoices {
    /** The id of the sound each voice was played with, or -1 for a note of a song, or nothing. */
    readonly soundId: Int32Array;
    /** The priority of the sound each voice was played with. */
    readonly soundPriority: Float64Array;
    /** When each voice's note started, in samples since the chip started. */
    readonly startedAt: Float64Array;
    /** Whether voice `v` is making a sound. */
    readonly isSounding: (v: number) => boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make `SoundPlays`. */
export interface SoundPlaysOptions {
    readonly voiceCount: number;
    /** Whether voice `v` is making a sound. */
    readonly isSounding: (v: number) => boolean;
    /** Releases voice `v`'s note. */
    readonly release: (v: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the plays of a synthesiser's voices, with no voice playing one. */
export function createSoundPlays(options: SoundPlaysOptions): SoundPlays {
    const { voiceCount, isSounding, release } = options;
    const soundId = new Int32Array(voiceCount);
    const soundPriority = new Float64Array(voiceCount);
    const startedAt = new Float64Array(voiceCount);
    const playId = new Float64Array(voiceCount);

    const plays: SoundPlays = {
        soundId,
        soundPriority,
        startedAt,
        playId,
        isSounding,

        choose(id, priority, maxVoices) {
            return chooseSoundVoice(plays, id, priority, maxVoices);
        },

        startNote(v, at) {
            soundId[v] = -1;
            soundPriority[v] = 0;
            playId[v] = -1;
            startedAt[v] = at;
        },

        claim(v, id, priority, play) {
            soundId[v] = id;
            soundPriority[v] = priority;
            playId[v] = play;
        },

        stop(play) {
            for (let v = 0; v < voiceCount; v++) {
                if (playId[v] === play) {
                    release(v);
                    playId[v] = -1;
                }
            }
        },

        findSoundOn(v) {
            if (!isSounding(v) || soundId[v] < 0) return undefined;
            return soundId[v];
        },

        reset() {
            for (let v = 0; v < voiceCount; v++) plays.startNote(v, 0);
        },
    };
    plays.reset();
    return plays;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Picks the voice for a sound played on its own. If the sound already plays
 * on `maxVoices` voices, it takes the oldest of them. If not, it takes a free
 * voice. Failing that, it takes the oldest voice playing a song's note or a
 * sound of equal or lower priority. Returns -1 if no voice qualifies, and
 * then the sound is not played.
 *
 * A song on the same chip takes its voices from the bottom up, channel n on
 * voice n, so free voices are taken from the top down. A sound may take a
 * song's voice, until that channel's next note takes it back, as on the old
 * consoles. Music plays best on a chip of its own.
 *
 * @param voices The chip's voices.
 * @param id The sound's id.
 * @param priority The sound's priority. It may take a voice from a sound of equal or lower priority.
 * @param maxVoices How many voices the sound may play on at once.
 */
export function chooseSoundVoice(voices: SoundVoices, id: number, priority: number, maxVoices: number): number {
    const { soundId, soundPriority, startedAt, isSounding } = voices;
    let own = 0;
    let oldestOwn = -1;
    let free = -1;
    let steal = -1;
    for (let v = soundId.length - 1; v >= 0; v--) {
        if (!isSounding(v)) {
            if (free < 0) free = v;
            continue;
        }
        if (soundId[v] === id) {
            own++;
            if (oldestOwn < 0 || startedAt[v] < startedAt[oldestOwn]) oldestOwn = v;
        }
        // A song's note can be taken
        const canTake = soundId[v] < 0 || soundPriority[v] <= priority;
        if (canTake && (steal < 0 || startedAt[v] < startedAt[steal])) steal = v;
    }
    if (own >= maxVoices && oldestOwn >= 0) return oldestOwn;
    if (free >= 0) return free;
    return steal;
}
