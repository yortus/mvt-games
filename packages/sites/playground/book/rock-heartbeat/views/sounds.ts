import { createAudio80Sound } from 'audio90';

// The game's sounds. Each is made once, as this module loads.

/** A heartbeat: a click of noise, then a low triangle thump. */
export const BEAT = createAudio80Sound({
    note: 'E-2',
    stepMs: 20,
    envelope: { attackMs: 0, decayMs: 180, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        noise      +24
        triangle   +7
        triangle   +0
        triangle   -3
    `,
});

/** A rock breaking: a burst of noise, falling. */
export const BREAK = createAudio80Sound({
    note: 'C-4',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    volume: 0.7,
    steps: `
        # wave   pitch  vol
        noise    +17    vF
        noise    +12    vE
        noise    +8     vC
        noise    +5     vA
        noise    +2     v7
        noise    +0     v4
    `,
});
