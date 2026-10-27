// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An audio chip's controls, for the code that owns the chip. They cover
 * pausing it, its output, and the start and end of each game. Every chip has
 * the same controls, so the code that owns them drives every chip in the
 * same way.
 *
 * The chip's factory makes the controls alongside the chip, as a separate
 * object. The code that plays sounds, such as a game's views, is given the
 * chip, and the controls stay with the code that owns it. Only that code
 * pauses the chip, resets it between games and sets the listener's volumes.
 * Because the controls are on another object, the code given the chip has
 * no way to call them.
 */
export interface AudioControls {
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
     * meanwhile sounding right. It also keeps each `stop`, and the latest
     * `releaseAll`, so a sound that started before the wait still stops.
     */
    readonly ready: Promise<void>;
    /** Whether the chip is paused. A chip starts unpaused. */
    readonly isPaused: boolean;
    /**
     * Holds the chip where it is, as a game pauses: its voices fade out at
     * once and keep their place, and its songs stop moving. Call it as the
     * game pauses, and as the page is hidden, if its sound should stop then.
     * A chip on the same audio context plays on, so a pause menu can play
     * its sounds on a chip of its own. Pausing a paused chip does nothing.
     */
    pause: () => void;
    /** Plays the chip on from where `pause` held it, fading its voices back in at once. Resuming a chip that isn't paused does nothing. */
    resume: () => void;
    /**
     * Silences every voice at once, and forgets every sound played so far.
     * Use it between games. The browser's chip fades its output to silence
     * over about 3 ms rather than cutting it, so that it does not click.
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

/**
 * A headless chip's controls. A headless chip has no sound card to keep its
 * time, so the code that owns it moves its clock on, by the same ticks as
 * the game's models. So the same ticks always make the same notes, which is
 * what makes a test of the sound exact.
 */
export interface HeadlessControls extends AudioControls {
    /**
     * Moves the chip's clock, and its songs, on by `deltaMs`. Call it once a
     * tick with the models' delta, before the views update. While the chip is
     * paused, it does nothing.
     */
    update: (deltaMs: number) => void;
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
