// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An audio chip's controls, for the code that runs the game loop and owns
 * the chip. They cover the chip's clock, its output, and the start and end
 * of each game. Every chip has the same controls, so the game loop drives
 * every chip in the same way.
 *
 * The chip's factory makes the controls alongside the chip, as a separate
 * object. The game's views are given the chip and play on it, and the
 * controls stay with the game loop. Only the game loop advances the clock,
 * pauses, resets between games and sets the listener's volumes. A view never
 * does. Because the controls are on another object, a view has no way to
 * call them.
 */
export interface AudioControls {
    /**
     * Resolves once the chip is ready to play, or rejects if it cannot. For
     * example, a browser's chip on an insecure page has no `AudioWorklet`.
     * For a chip with nothing to load, it is already resolved.
     *
     * The chip cannot play before `ready` resolves. In a browser, it also
     * cannot play while the audio context is not running. Until it can, it
     * drops notes and sound effects, so none play late. It keeps the latest
     * value of each setting, such as a filter's cutoff, and applies it once
     * it can play. A song sets most of its settings once, when it starts, so
     * this keeps a song started meanwhile sounding right. It also keeps the
     * latest call to stop a note (`noteOff`, or `releaseAll`) on each voice.
     * So a note that started before the wait still stops.
     */
    readonly ready: Promise<void>;
    /**
     * Advances the chip's clock by `deltaMs`. Call it once a tick with the
     * models' delta, before the views update. Never call it while the game is
     * paused.
     */
    update: (deltaMs: number) => void;
    /** Sends this tick's writes to be played. Call it once a tick, after the views have refreshed. */
    flush: () => void;
    /**
     * Silences every voice at once, and forgets every instrument and effect
     * played so far. Use it between games. The browser's chip fades its
     * output to silence over about 3 ms rather than cutting it, so that it
     * does not click.
     */
    reset: () => void;
    /** The whole chip's volume, 0 to 1. A value outside that range is clamped to it. */
    volume: number;
    /** Whether the chip is muted. A muted chip is silent, whatever `volume` says. */
    isMuted: boolean;
    /**
     * A gain on the voices playing music, from 0 to 2. A value outside that
     * range is clamped to it. At 1, the voices play as their songs are
     * written. It is the listener's setting, so a reset leaves it alone.
     */
    musicVolume: number;
    /** A gain on the voices playing effects. It works like `musicVolume`. */
    effectsVolume: number;
    /** Stops the chip for good and releases what it holds, such as its worklet in a browser. Writes after this do nothing. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The highest `musicVolume` and `effectsVolume`, which plays twice as loud as written. */
export const MAX_MIX_VOLUME = 2;

/** Clamps a volume to the range 0 to `max`. NaN becomes 0. */
export function clampVolume(value: number, max: number): number {
    return value > 0 ? (value < max ? value : max) : 0;
}
