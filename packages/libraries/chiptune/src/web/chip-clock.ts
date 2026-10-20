// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Maps chip time to the samples the sound card asks for. Only the game
 * loop's ticks advance chip time. The clock plays a steady distance behind
 * the newest chip time it has been given, and never past it. That distance
 * is called the lead. It is long enough to ride out late frames, so the
 * music plays on however unevenly the ticks arrive.
 *
 * - **Starting**, it waits until it has a full lead, then fades in. A late
 *   frame may bring more than a full lead of ticks. If so, it skips ahead to
 *   start with just a full lead.
 * - **Drift** between the display's clock and the sound card's is corrected
 *   by playing chip time a little faster or slower. That moves when writes
 *   take effect, never the pitch. A short lead, as after a frame longer than
 *   the game loop's longest step, is won back quickly, by playing up to
 *   `MAX_SLOW_DOWN` slower. A long one is let go of slowly.
 * - **Far behind**, as after a burst of ticks following a long frame, it
 *   jumps forward.
 * - **Stalled** means it has played all the chip time it was given while the
 *   game is still running, because a tick is later than even the lead allows
 *   for. Chip time then stands still, but the voices keep sounding, so a note
 *   rings on and the next one starts a little late, rather than the sound
 *   dropping out. Once it has half a lead again, it plays on. A stall that
 *   lasts, as in a hidden tab, fades out, and it then starts again as it did
 *   at first.
 * - **Paused** means the ticks keep coming but bring no more chip time, as
 *   while the game is paused. It fades out at once, and holds every voice
 *   where it is. When chip time moves again, it fades back in at once,
 *   because it kept the rest of its lead.
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
    /** What it is doing: waiting for its first full lead, playing, stalled or paused. */
    readonly phase: ChipClockPhase;
    /** The lead just after each tick arrives, in ms, smoothed over recent ticks. */
    readonly leadMs: number;
    /** How many times it has stalled since it was made. */
    readonly stallCount: number;
    /** The chip time, in ms, the planned block starts at. */
    readonly fromMs: number;
    /**
     * The chip time, in ms, that each sample of the planned block covers. It
     * is about 1000 divided by the sample rate, a little more or less to
     * correct drift. It is 0 while chip time stands still.
     */
    readonly msPerSample: number;
    /** The planned block's gain at its start, from 0 to 1. The gain ramps to `gainTo` across the block. */
    readonly gainFrom: number;
    /** The planned block's gain at its end, 0 to 1. */
    readonly gainTo: number;
    /** Whether the planned block is silence, because the clock is waiting for chip time or paused. */
    readonly isSilent: boolean;
    /** Records the chip time, in ms, that a tick has reached. Every tick calls it, even one that brings no chip time. */
    receive: (horizonMs: number) => void;
    /** Plans the next block of `frames` samples. */
    plan: (frames: number) => void;
    /** Forgets the chip time received, so it waits for a full lead again. */
    reset: () => void;
}

/**
 * What a chip clock is doing: `'waiting'` for a full lead, as at first,
 * `'playing'`, `'stalled'` with chip time standing still while the voices
 * sound, or `'paused'`, silent while the ticks bring no chip time.
 */
export type ChipClockPhase = 'waiting' | 'playing' | 'stalled' | 'paused';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip clock. */
export interface ChipClockOptions {
    /** The sound card's sample rate, in Hz. */
    readonly sampleRate: number;
    /** The lead it keeps, just after a tick arrives, in ms. Defaults to 100. */
    readonly leadMs?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a clock that has received no chip time yet, so it plans silence. */
export function createChipClock(options: ChipClockOptions): ChipClock {
    const nominalMsPerSample = 1000 / options.sampleRate;
    const targetLead = options.leadMs ?? DEFAULT_LEAD_MS;

    let hasHorizon = false;
    let horizon = 0;
    let playhead = 0;
    let phase: ChipClockPhase = 'waiting';
    let smoothedLead = 0;
    let stallCount = 0;
    // The ticks in a row that brought no chip time, and how long it has been stalled, in ms of the sound card's time
    let stillTicks = 0;
    let stalledMs = 0;

    // The planned block
    let fromMs = 0;
    let msPerSample = 0;
    let gainFrom = 0;
    let gainTo = 0;
    let isSilent = true;

    const clock: ChipClock = {
        get playheadMs() {
            return playhead;
        },
        get horizonMs() {
            return horizon;
        },
        get phase() {
            return phase;
        },
        get leadMs() {
            return smoothedLead;
        },
        get stallCount() {
            return stallCount;
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

        receive(horizonMs) {
            if (!hasHorizon) {
                hasHorizon = true;
                horizon = horizonMs;
                playhead = horizonMs;
                return;
            }
            if (horizonMs > horizon) {
                horizon = horizonMs;
                stillTicks = 0;
            }
            else {
                stillTicks++;
            }
            if (phase === 'playing') smoothedLead += (horizon - playhead - smoothedLead) * LEAD_SMOOTHING;
        },

        plan(frames) {
            const lead = horizon - playhead;
            switch (phase) {
                case 'waiting':
                    if (!hasHorizon || lead < targetLead) {
                        planSilence();
                        return;
                    }
                    // A late frame may have brought more than a full lead of ticks. Start with just a full lead
                    playhead = horizon - targetLead;
                    smoothedLead = targetLead;
                    phase = 'playing';
                    planPlaying(frames, 0, 1);
                    return;
                case 'paused':
                    if (stillTicks > 0 || lead < targetLead * RESUME_LEAD_FRACTION) {
                        planSilence();
                        return;
                    }
                    smoothedLead = lead;
                    phase = 'playing';
                    planPlaying(frames, 0, 1);
                    return;
                case 'stalled':
                    if (stillTicks >= PAUSE_AFTER_TICKS) {
                        // The ticks are back, but bring no chip time, so the game has paused
                        phase = 'paused';
                        planStill(0);
                        return;
                    }
                    if (lead >= targetLead * RESUME_LEAD_FRACTION) {
                        smoothedLead = lead;
                        phase = 'playing';
                        planPlaying(frames, 1, 1);
                        return;
                    }
                    stalledMs += frames * nominalMsPerSample;
                    if (stalledMs > MAX_STALL_MS) {
                        // No tick for this long is no late frame. Fade out, and start again as at first
                        phase = 'waiting';
                        planStill(0);
                        return;
                    }
                    planStill(1);
                    return;
                case 'playing':
                    if (stillTicks >= PAUSE_AFTER_TICKS) {
                        // Play this block as usual, fading out, and keep the rest of the lead for when the game resumes
                        phase = 'paused';
                        planPlaying(frames, 1, 0);
                        return;
                    }
                    planPlaying(frames, 1, 1);
                    return;
            }
        },

        reset() {
            hasHorizon = false;
            phase = 'waiting';
            horizon = playhead = smoothedLead = stillTicks = 0;
            planSilence();
        },
    };

    return clock;

    /** Plans a block that plays chip time on from the playhead, with its gain ramping from `from` to `to`. */
    function planPlaying(frames: number, from: number, to: number): void {
        if (horizon - playhead > targetLead + JUMP_MARGIN_MS) {
            playhead = horizon - targetLead;
            smoothedLead = targetLead;
        }
        let rate = 1 + (smoothedLead - targetLead) * RATE_PER_MS_OF_ERROR;
        if (rate > 1 + MAX_SPEED_UP) rate = 1 + MAX_SPEED_UP;
        else if (rate < 1 - MAX_SLOW_DOWN) rate = 1 - MAX_SLOW_DOWN;
        msPerSample = nominalMsPerSample * rate;
        if (playhead + frames * msPerSample > horizon) {
            // It has played all the chip time it was given. Play what is left, and stand still
            msPerSample = Math.max(0, horizon - playhead) / frames;
            if (phase === 'playing') {
                phase = 'stalled';
                stallCount++;
                stalledMs = 0;
            }
        }
        isSilent = false;
        fromMs = playhead;
        gainFrom = from;
        gainTo = to;
        playhead += frames * msPerSample;
    }

    /** Plans a block with chip time standing still, its gain ramping from 1 to `to`. The voices sound on as they were. */
    function planStill(to: number): void {
        isSilent = false;
        fromMs = playhead;
        msPerSample = 0;
        gainFrom = 1;
        gainTo = to;
    }

    /** Plans a block of silence. */
    function planSilence(): void {
        isSilent = true;
        fromMs = playhead;
        msPerSample = 0;
        gainFrom = gainTo = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The lead it keeps by default, in ms. It rides out a frame or two at 30
 * frames a second, on a sound card that asks for 20 ms at a time.
 */
const DEFAULT_LEAD_MS = 100;
/** Beyond its lead and this much more, in ms, it jumps forward. */
const JUMP_MARGIN_MS = 200;
/** How much of a full lead it needs, once stalled or paused, to play again. */
const RESUME_LEAD_FRACTION = 0.5;
/** How many ticks in a row with no new chip time mean the game has paused. One alone can be a frame with no time. */
const PAUSE_AFTER_TICKS = 2;
/** The longest it stays stalled, in ms, before it fades out. A hidden tab, or a long hang, stops the ticks for longer. */
const MAX_STALL_MS = 300;
/** How much faster than real time it may play chip time, to let go of a lead that is too long. */
const MAX_SPEED_UP = 0.005;
/**
 * How much slower than real time it may play chip time, to win back a lead
 * that is too short. It only moves when notes start: a lead 20 ms short is
 * won back in about 2 seconds, with the music 1% slower meanwhile.
 */
const MAX_SLOW_DOWN = 0.02;
/**
 * How much of the gap between each tick's lead and the smoothed lead closes
 * per tick. The smoothed lead settles in about a third of a second.
 */
const LEAD_SMOOTHING = 0.05;
/** How much faster chip time plays for each ms the lead is too long, or slower for each ms too short. A lead 10 ms too long plays 0.5% fast. */
const RATE_PER_MS_OF_ERROR = 0.0005;
