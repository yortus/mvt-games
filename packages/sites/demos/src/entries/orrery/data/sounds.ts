import { type Audio80SoundOptions, createAudio80Sound } from 'audio90';

// The orrery's sounds, for the Audio80, written for this demo. The gears
// tick and tock by turns, like a clock's escapement, a tooth at a time.

// ---------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------

/**
 * One tooth's click. A snap of noise comes first, then a short pulse that
 * dies away fast, for a wooden knock under the snap. The tick and the tock
 * differ only in pitch.
 */
const CLICK: Audio80SoundOptions = {
    stepMs: 8,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 25 },
    priority: 0,
    maxVoices: 2,
    volume: 0.2,
    steps: `
        # wave   pitch  vol
        noise    +12    vF
        pulse    +0     vC
        pulse    +0     v7
        pulse    +0     v3
    `,
};

/** The higher click, on every other tooth. */
export const TICK = createAudio80Sound({ ...CLICK, note: 'A-5' });

/** The lower click, on the teeth between. */
export const TOCK = createAudio80Sound({ ...CLICK, note: 'E-5' });
