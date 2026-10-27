// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

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
// Functions
// ---------------------------------------------------------------------------

/**
 * Picks the voice for a sound played on its own, from the voices not kept
 * for music. If the sound already plays on `maxVoices` voices, it takes the
 * oldest of them. If not, it takes a free voice. Failing that, it takes the
 * oldest voice playing a leftover music note or a sound of equal or lower
 * priority. Returns -1 if no voice qualifies, and then the sound is not
 * played.
 *
 * Free voices are taken from the top down, because music takes them from
 * the bottom up. So a sound played just as a song starts is not put on a
 * voice the song is about to take. For example, a sound for a ship's return
 * may play just as the ship's tune starts.
 *
 * @param voices The chip's voices.
 * @param musicVoices How many voices, counting up from voice 0, are kept for music.
 * @param id The sound's id.
 * @param priority The sound's priority. It may take a voice from a sound of equal or lower priority.
 * @param maxVoices How many voices the sound may play on at once.
 */
export function chooseSoundVoice(voices: SoundVoices, musicVoices: number, id: number, priority: number, maxVoices: number): number {
    const { soundId, soundPriority, startedAt, isSounding } = voices;
    let own = 0;
    let oldestOwn = -1;
    let free = -1;
    let steal = -1;
    for (let v = soundId.length - 1; v >= musicVoices; v--) {
        if (!isSounding(v)) {
            if (free < 0) free = v;
            continue;
        }
        if (soundId[v] === id) {
            own++;
            if (oldestOwn < 0 || startedAt[v] < startedAt[oldestOwn]) oldestOwn = v;
        }
        // A note the music left on a voice it no longer keeps can be taken
        const canTake = soundId[v] < 0 || soundPriority[v] <= priority;
        if (canTake && (steal < 0 || startedAt[v] < startedAt[steal])) steal = v;
    }
    if (own >= maxVoices && oldestOwn >= 0) return oldestOwn;
    if (free >= 0) return free;
    return steal;
}
