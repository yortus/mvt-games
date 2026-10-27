// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every chip has, whatever its kind: it plays songs and sounds, and it
 * can be paused, turned down and destroyed. `Song`, `Sound` and
 * `PlayOptions` are the chip's own types, such as `Audio80Song`.
 *
 * A chip plays one song at a time, on a sequencer of its own. In a browser,
 * the sequencer runs on the audio thread, on the sound card's clock, so a
 * late frame never holds the music up. Sounds play, each on a voice the chip
 * chooses. A chip can play a song and sounds together, but a sound may take
 * a song's voice until that channel's next note takes it back, as on the old
 * consoles. So a game plays its music on one chip and its sound effects on
 * another.
 *
 * What it reports of the song, `song`, `orderIndex`, `row` and `beat`, is
 * what the listener hears now. In a browser, that trails what was asked by
 * the time the sound takes to reach the speaker. So a view that shows the
 * song, as a tracker does, shows the row being heard.
 */
export interface SoundChip<Song, Sound, PlayOptions> {
    /**
     * Resolves once the chip is ready to play, or rejects if it cannot. For
     * example, a browser's chip on an insecure page has no `AudioWorklet`.
     * For a chip with nothing to load, it is already resolved.
     *
     * The chip cannot play before `ready` resolves. In a browser, it also
     * cannot play while the audio context is not running. It doesn't play
     * while it is paused either. Until it can, it drops the sounds played, so
     * none play late. It keeps the latest value of each setting, such as a
     * filter's cutoff, and applies it once it can play. A song sets most of
     * its settings once, when it starts, so this keeps a song started
     * meanwhile sounding right. It also keeps each `stop`, so a sound that
     * started before the wait still stops.
     */
    readonly ready: Promise<void>;
    /**
     * Plays a sound or a song, and returns the play's id, which `stop`
     * takes.
     *
     * A sound plays now, on a voice the chip chooses. It picks a free voice
     * if there is one. If not, it takes the voice of the oldest song note, or
     * of the oldest sound whose priority is no higher than this one's. If
     * there is none, the sound doesn't play. A sound played with a
     * `lengthMs` of `Infinity` holds its note until it is stopped.
     *
     * A song starts from its beginning, in place of any song playing, and
     * any song queued is cancelled, so nothing queued before plays after it.
     */
    play: {
        (sound: Sound, options?: PlayOptions): number;
        (song: Song): number;
    };
    /**
     * Plays `song` without a gap when the song playing reaches the end of
     * its order, even if that song loops. If no song is playing, it plays
     * `song` at once. It returns the id of the play it follows, which `stop`
     * takes, or a new one if it starts at once.
     */
    queue: (song: Song) => number;
    /**
     * Stops the play with id `id`. For a sound, it releases the play's note,
     * so it fades out as its envelope's release says. It does nothing if the
     * play has already ended, or another sound has taken its voice. For a
     * song, it releases the song's notes and stops the song, and any song
     * queued after it, unless another song has been played since.
     *
     * With no `id`, it stops everything: the song, and every voice's note.
     * While the chip is paused, nothing is heard, so it cuts every voice at
     * once instead, rather than letting the notes fade out as it resumes.
     */
    stop: (id?: number) => void;
    /** The song heard playing, or undefined when none is. A song played, queued with none playing, or stopped shows here at once. */
    readonly song: Song | undefined;
    /** The entry in the song's order whose row is heard now. 0 when no song is playing, and while a song just played has yet to reach the speaker. */
    readonly orderIndex: number;
    /** The row heard now, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /** Where the song heard has got to, in beats from its start. Views can use it to move in time with the music. 0 when no song is playing. */
    readonly beat: number;
    /**
     * A multiplier on the song's tempo, where 1 plays it at its own tempo. 0
     * holds the song where it is. Its notes ring on as their envelopes allow,
     * and its slides stop. On the Audio90, the LFOs and the echo timed in
     * beats follow it too, and a scale of 0 holds those LFOs. This suits music
     * that plays only while something moves. A negative or non-finite value
     * acts as 0. It goes to the chip only as it changes, so a view can set it
     * every refresh. A change made in the same moment as `play`, before it or
     * after it, applies from the song's start, so the tempo can follow the
     * song just chosen. Only a glide in the song's first row keeps the tempo
     * the song started at.
     */
    tempoScale: number;
    /**
     * Whether the chip is paused by `pause`. A chip starts unpaused. A
     * browser's chip also holds its sound while the page is hidden, unless
     * it was made with `pauseWhenHidden: false`, but that leaves `isPaused`
     * as it is.
     */
    readonly isPaused: boolean;
    /**
     * Holds the chip where it is, as a game pauses: its voices fade out at
     * once and keep their place, and its song stops moving. Call it as the
     * game pauses. A chip on the same audio context plays on, so a pause menu
     * can play its sounds on a chip of its own. Pausing a paused chip does
     * nothing.
     */
    pause: () => void;
    /** Plays the chip on from where `pause` held it, fading its voices back in at once. Resuming a chip that isn't paused does nothing. */
    resume: () => void;
    /**
     * The chip's volume, 0 to 1, where 1 plays its songs and sounds as they
     * are written. A value outside that range is clamped to it. A change
     * settles over about 30 ms, so it doesn't click.
     */
    volume: number;
    /** Whether the chip is muted. A muted chip is silent, whatever `volume` says. */
    isMuted: boolean;
    /** Stops the chip for good and releases what it holds, such as its worklet in a browser. Calls after this do nothing. */
    destroy: () => void;
}

/**
 * What plays a chip's songs: in a browser, the sequencer in the worklet,
 * and on a headless chip, a song player run on the chip's clock. It plays
 * one song at a time. `S` is the chip's song type.
 *
 * Each call takes effect at once on a headless chip, and as soon as the
 * audio thread hears of it in a browser. What it reports is what the
 * listener hears now.
 */
export interface SongSequencer<S> {
    /** The song heard playing, or undefined when none is. */
    readonly song: S | undefined;
    /** The entry in the song's order whose row is heard. 0 when no song is playing. */
    readonly orderIndex: number;
    /** The row heard, within the pattern of the entry at `orderIndex`. 0 when no song is playing. */
    readonly row: number;
    /** Where the song heard has got to, in beats from its start. 0 when no song is playing. */
    readonly beat: number;
    /** Starts `song` from its beginning, releasing any song playing, and cancels any song queued. */
    play: (song: S) => void;
    /** Plays `song` without a gap when the song playing reaches the end of its order, or at once if none is playing. */
    queue: (song: S) => void;
    /** Releases the song's notes, gives its voices back to sounds, and stops. */
    stop: () => void;
    /** Sets the tempo scale, where 1 is the song's own tempo and 0 holds it where it is. */
    setTempoScale: (scale: number) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Clamps a volume to the range 0 to 1. NaN becomes 0. */
export function clampVolume(value: number): number {
    return value > 0 ? (value < 1 ? value : 1) : 0;
}

/**
 * Copies the members of `extra` onto `base`, getters and setters as they
 * are, and returns `base`. A chip's factory joins the parts every chip
 * shares with its own this way, without reading a getter as it copies it.
 */
export function joinMembers<B extends object, E extends object>(base: B, extra: E): B & E {
    return Object.defineProperties(base, Object.getOwnPropertyDescriptors(extra)) as B & E;
}
