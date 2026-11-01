import { createAudio80Sound } from 'audio90';

// The sounds the ship's audio view plays. Each is made once, as this module
// loads.

/** A zap: a pulse falling an octave in six fast steps, its width narrowing. */
export const SHOT = createAudio80Sound({
    note: 'C-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    volume: 0.5,
    steps: `
        # wave   pitch  width
        pulse    +0     p8
        pulse    -2     p6
        pulse    -5     p4
        pulse    -8     p3
        pulse    -10    p2
        pulse    -12    p1
    `,
});

/** A crash: a burst of noise, falling in pitch and volume. */
export const SHIP_EXPLODE = createAudio80Sound({
    note: 'C-4',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    priority: 1,
    steps: `
        # wave   pitch  vol
        noise    +12    vF
        noise    +7     vE
        noise    +3     vC
        noise    +0     vA
        noise    -3     v8
        noise    -6     v6
        noise    -9     v4
        noise    -12    v2
    `,
});
