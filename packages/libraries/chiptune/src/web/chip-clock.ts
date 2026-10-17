// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Maps chip time to the samples the sound card asks for. Only the game
 * loop's ticks advance chip time. The clock plays a steady distance behind
 * the newest chip time it has been given, and never past it. That distance
 * is called the lead.
 *
 * - **Starting**, and after running dry, it waits until it has a full lead,
 *   then fades in. A late frame may bring more than a full lead of ticks. If
 *   so, it skips ahead to start with just a full lead.
 * - **Drift** between the display's clock and the sound card's is corrected
 *   by playing chip time up to `maxRateChange` faster or slower. That moves
 *   when writes take effect, never the pitch.
 * - **Far behind**, as after a burst of ticks following a long frame, it
 *   jumps forward.
 * - **Running dry** means it has played all the chip time it was given, as
 *   in a pause, a hidden tab or a long frame. It then fades out over its last
 *   block and stops, holding every voice where it is.
 *
 * For each block, `plan` decides how much chip time the block covers. The
 * plan is then in `fromMs`, `msPerSample`, `gainFrom`, `gainTo` and
 * `isSilent`. What it plans depends only on the ticks received and the
 * blocks planned, so it can be tested without a sound card.
 */
export interface ChipClock {
    /** The chip time, in ms, the next block starts at. */
    readonly playheadMs: number;
    /** The newest chip time received, in ms. */
    readonly horizonMs: number;
    /** Whether it is playing. It is false before it starts, and from when it runs dry until it has a full lead again. */
    readonly isPlaying: boolean;
    /** The lead just after each tick arrives, in ms, smoothed over recent ticks. */
    readonly leadMs: number;
    /** The chip time, in ms, the planned block starts at. */
    readonly fromMs: number;
    /**
     * The chip time, in ms, that each sample of the planned block covers. It
     * is about 1000 divided by the sample rate, a little more or less to
     * correct drift.
     */
    readonly msPerSample: number;
    /** The planned block's gain at its start, from 0 to 1. The gain ramps to `gainTo` across the block. */
    readonly gainFrom: number;
    /** The planned block's gain at its end, 0 to 1. */
    readonly gainTo: number;
    /** Whether the planned block is silence, because the clock is waiting for chip time. */
    readonly isSilent: boolean;
    /** Records the chip time, in ms, that a tick has reached. */
    receive: (horizonMs: number) => void;
    /** Plans the next block of `frames` samples. */
    plan: (frames: number) => void;
    /** Forgets the chip time received, so it waits for a full lead again. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip clock. */
export interface ChipClockOptions {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** The lead it keeps, just after a tick arrives, in ms. Defaults to 35. */
    readonly leadMs?: number;
    /** Beyond this lead, in ms, it jumps forward. Defaults to `leadMs` + 200. */
    readonly maxLeadMs?: number;
    /** How much faster or slower than real time it may play chip time to correct drift, as a fraction (0.005 is 0.5%). Defaults to 0.005. */
    readonly maxRateChange?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a clock that has received no chip time yet, so it plans silence. */
export function createChipClock(options: ChipClockOptions): ChipClock {
    const nominalMsPerSample = 1000 / options.sampleRate;
    const targetLead = options.leadMs ?? DEFAULT_LEAD_MS;
    const maxLead = options.maxLeadMs ?? targetLead + DEFAULT_JUMP_MARGIN_MS;
    const maxRateChange = options.maxRateChange ?? DEFAULT_MAX_RATE_CHANGE;

    let hasHorizon = false;
    let horizon = 0;
    let playhead = 0;
    let isPlaying = false;
    let smoothedLead = 0;
    let gain = 0;

    // The planned block
    let fromMs = 0;
    let msPerSample = nominalMsPerSample;
    let gainFrom = 0;
    let gainTo = 0;
    let isSilent = true;

    const clock: ChipClock = {
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
        get playheadMs() {
            return playhead;
        },
        get horizonMs() {
            return horizon;
        },
        get isPlaying() {
            return isPlaying;
        },
        get leadMs() {
            return smoothedLead;
        },

        receive(horizonMs) {
            if (!hasHorizon) {
                hasHorizon = true;
                horizon = horizonMs;
                playhead = horizonMs;
                return;
            }
            if (horizonMs > horizon) horizon = horizonMs;
            if (isPlaying) smoothedLead += (horizon - playhead - smoothedLead) * LEAD_SMOOTHING;
        },

        plan(frames) {
            if (!isPlaying) {
                if (!hasHorizon || horizon - playhead < targetLead) {
                    isSilent = true;
                    gainFrom = gainTo = 0;
                    return;
                }
                isPlaying = true;
                // A late frame may have brought more than a full lead of ticks. Start with just a full lead
                if (horizon - playhead > targetLead) playhead = horizon - targetLead;
                smoothedLead = horizon - playhead;
            }
            if (horizon - playhead > maxLead) {
                playhead = horizon - targetLead;
                smoothedLead = targetLead;
            }
            let rate = 1 + (smoothedLead - targetLead) * RATE_PER_MS_OF_ERROR;
            if (rate > 1 + maxRateChange) rate = 1 + maxRateChange;
            else if (rate < 1 - maxRateChange) rate = 1 - maxRateChange;
            msPerSample = nominalMsPerSample * rate;
            isSilent = false;
            fromMs = playhead;
            gainFrom = gain;
            gain = 1;
            if (playhead + frames * msPerSample > horizon) {
                // It has run dry. Play what is left, fading out, and wait
                msPerSample = Math.max(0, horizon - playhead) / frames;
                isPlaying = false;
                gain = 0;
            }
            gainTo = gain;
            playhead += frames * msPerSample;
        },

        reset() {
            hasHorizon = false;
            isPlaying = false;
            horizon = playhead = smoothedLead = gain = 0;
        },
    };

    return clock;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_LEAD_MS = 35;
const DEFAULT_JUMP_MARGIN_MS = 200;
const DEFAULT_MAX_RATE_CHANGE = 0.005;
/**
 * How much of the gap between each tick's lead and the smoothed lead closes
 * per tick. The smoothed lead settles in about a third of a second.
 */
const LEAD_SMOOTHING = 0.05;
/** How much faster chip time plays for each ms the lead is too long. A lead 10 ms too long plays 0.5% fast. */
const RATE_PER_MS_OF_ERROR = 0.0005;
