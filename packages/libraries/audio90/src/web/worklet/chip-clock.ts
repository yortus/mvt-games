// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Maps chip time to the samples the sound card asks for. Chip time is the
 * sound card's: each block moves it on by the block's length, from 0 at the
 * first block, except while the chip is paused.
 *
 * - **Pausing** holds chip time where it is. The next block fades out with
 *   every voice sounding on as it was, and the blocks after it are silence.
 *   The voices keep their place, so nothing is lost.
 * - **Resuming** moves chip time on from where it was held, and the next
 *   block fades back in. A resume before the fade-out has played cancels the
 *   pause, with no fade at all.
 *
 * For each block, `plan` decides how much chip time the block covers. The
 * plan is then in `fromMs`, `msPerSample`, `gainFrom`, `gainTo` and
 * `isSilent`. What it plans depends only on the calls it was given, so it
 * can be tested without a sound card.
 */
export interface ChipClock {
    /** The chip time, in ms, the next block starts at. */
    readonly playheadMs: number;
    /** Whether the clock is paused, or about to fade out to a pause. */
    readonly isPaused: boolean;
    /** The chip time, in ms, the planned block starts at. */
    readonly fromMs: number;
    /** The chip time, in ms, that each sample of the planned block covers: 1000 divided by the sample rate, or 0 while chip time stands still. */
    readonly msPerSample: number;
    /** The planned block's gain at its start, from 0 to 1. The gain ramps to `gainTo` across the block. */
    readonly gainFrom: number;
    /** The planned block's gain at its end, 0 to 1. */
    readonly gainTo: number;
    /** Whether the planned block is silence, because the clock is paused. */
    readonly isSilent: boolean;
    /** Holds chip time where it is, and fades out over the next block. */
    pause: () => void;
    /** Moves chip time on again, and fades in over the next block. */
    resume: () => void;
    /** Plans the next block of `frames` samples. */
    plan: (frames: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip clock. */
export interface ChipClockOptions {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a clock at chip time 0, playing. */
export function createChipClock(options: ChipClockOptions): ChipClock {
    const nominalMsPerSample = 1000 / options.sampleRate;

    let playhead = 0;
    let isPaused = false;
    // Whether the next block fades out to the pause, or fades in from it
    let isFadingOut = false;
    let isFadingIn = false;

    // The planned block
    let fromMs = 0;
    let msPerSample = 0;
    let gainFrom = 1;
    let gainTo = 1;
    let isSilent = false;

    return {
        get playheadMs() {
            return playhead;
        },
        get isPaused() {
            return isPaused;
        },
        get fromMs() {
            return fromMs;
        },
        get msPerSample() {
            return msPerSample;
        },
        get gainFrom() {
            return gainFrom;
        },
        get gainTo() {
            return gainTo;
        },
        get isSilent() {
            return isSilent;
        },

        pause() {
            if (isPaused) return;
            isPaused = true;
            // A resume that has not yet faded in was never heard, so there is nothing to fade out
            if (isFadingIn) isFadingIn = false;
            else isFadingOut = true;
        },

        resume() {
            if (!isPaused) return;
            isPaused = false;
            // A pause that has not yet faded out was never heard, so it is cancelled with no fade
            if (isFadingOut) isFadingOut = false;
            else isFadingIn = true;
        },

        plan(frames) {
            fromMs = playhead;
            isSilent = false;
            if (isFadingOut) {
                // Chip time stands still, and the voices sound on as they were, fading out
                isFadingOut = false;
                msPerSample = 0;
                gainFrom = 1;
                gainTo = 0;
                return;
            }
            if (isPaused) {
                isSilent = true;
                msPerSample = 0;
                gainFrom = gainTo = 0;
                return;
            }
            msPerSample = nominalMsPerSample;
            gainFrom = isFadingIn ? 0 : 1;
            gainTo = 1;
            isFadingIn = false;
            playhead += frames * msPerSample;
        },
    };
}
