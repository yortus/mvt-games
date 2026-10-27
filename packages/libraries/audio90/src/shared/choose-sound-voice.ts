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
