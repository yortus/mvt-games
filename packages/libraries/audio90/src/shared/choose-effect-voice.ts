// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the effect voice allocator reads about the chip's voices. Each array has one slot per voice. */
export interface EffectVoices {
    /** The id of the effect each voice is playing, or -1 for music or nothing. */
    readonly effectId: Int32Array;
    /** The priority of the effect each voice is playing. */
    readonly effectPriority: Float64Array;
    /** When each voice's note started, in samples since the chip started. */
    readonly startedAt: Float64Array;
    /** Whether voice `v` is making a sound. */
    readonly isSounding: (v: number) => boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Picks the voice for a new effect from the voices not kept for music. If
 * the effect already plays on `maxVoices` voices, it takes the oldest of
 * them. If not, it takes a free voice. Failing that, it takes the oldest
 * voice playing a leftover music note or an effect of equal or lower
 * priority. Returns -1 if no voice qualifies, and then the effect is not
 * played.
 *
 * Free voices are taken from the top down, because music takes them from
 * the bottom up. So an effect played just as a song starts is not put on a
 * voice the song is about to take. For example, a sound for a ship's return
 * may play just as the ship's tune starts.
 *
 * @param voices The chip's voices.
 * @param musicVoices How many voices, counting up from voice 0, are kept for music.
 * @param id The effect's id.
 * @param priority The effect's priority. It may take a voice from an effect of equal or lower priority.
 * @param maxVoices How many voices the effect may play on at once.
 */
export function chooseEffectVoice(voices: EffectVoices, musicVoices: number, id: number, priority: number, maxVoices: number): number {
    const { effectId, effectPriority, startedAt, isSounding } = voices;
    let own = 0;
    let oldestOwn = -1;
    let free = -1;
    let steal = -1;
    for (let v = effectId.length - 1; v >= musicVoices; v--) {
        if (!isSounding(v)) {
            if (free < 0) free = v;
            continue;
        }
        if (effectId[v] === id) {
            own++;
            if (oldestOwn < 0 || startedAt[v] < startedAt[oldestOwn]) oldestOwn = v;
        }
        // A note the music left on a voice it no longer keeps can be taken
        const canTake = effectId[v] < 0 || effectPriority[v] <= priority;
        if (canTake && (steal < 0 || startedAt[v] < startedAt[steal])) steal = v;
    }
    if (own >= maxVoices && oldestOwn >= 0) return oldestOwn;
    if (free >= 0) return free;
    return steal;
}
