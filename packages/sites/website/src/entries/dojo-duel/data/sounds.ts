import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// Dojo Duel's instruments and sound effects, for the Audio80. They are all
// written for this game. Each swish is noise through filter `b`. The `f`
// column of its step table steps the filter's cutoff up and then down, so the
// rush of air rises and falls with the blow.

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** A plucked string, something like a koto. It is a narrow pulse wave that dies away and rings in the echo. */
export const KOTO = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.18,
    pulseSweep: { to: 0.35, ms: 400 },
    envelope: { attackMs: 1, decayMs: 420, sustain: 0.15, releaseMs: 220 },
    vibrato: { semitones: 0.15, hz: 6, delayMs: 260 },
    echo: 0.35,
    volume: 0.7,
});

/** A breathy flute for long notes. It is a triangle wave that is slow to start, with a wide vibrato. */
export const FLUTE = createInstrument({
    wave: 'triangle',
    envelope: { attackMs: 70, decayMs: 300, sustain: 0.8, releaseMs: 260 },
    vibrato: { semitones: 0.3, hz: 5, delayMs: 160 },
    echo: 0.3,
    volume: 0.9,
});

/** The chords, played as arpeggios. It is a soft square wave, kept quiet behind the lead. */
export const CHORD = createInstrument({
    wave: 'pulse',
    pulseWidth: 0.5,
    envelope: { attackMs: 2, decayMs: 260, sustain: 0.3, releaseMs: 120 },
    echo: 0.2,
    volume: 0.35,
});

/** A plucked bass. Its filter closes quickly on each note. */
export const BASS = createInstrument({
    wave: 'saw',
    envelope: { attackMs: 1, decayMs: 200, sustain: 0.35, releaseMs: 70 },
    filter: 'a',
    filterSweep: { fromHz: 1800, toHz: 300, ms: 160 },
    volume: 0.75,
});

/** A taiko drum. It is a slap of noise, then a low triangle wave that sinks in pitch. */
export const TAIKO = createInstrument({
    note: 'C-2',
    envelope: { attackMs: 0, decayMs: 320, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        noise      +19
        triangle   +7
        triangle   +3
        triangle   +0
        triangle   -2
        triangle   -4
    `,
});

/** A rim knock, which is a short, high crack of noise. */
export const RIM = createInstrument({
    wave: 'noise',
    note: 'G-6',
    envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 0 },
    volume: 0.45,
});

/** A shaker, which is a very short hiss of noise. */
export const SHAKER = createInstrument({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 0 },
    volume: 0.25,
});

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** The swish of a punch. It is short and high. */
export const PUNCH_SWISH = createSoundEffect({
    note: 'C-7',
    filter: 'b',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    priority: 0,
    maxVoices: 2,
    volume: 1,
    steps: `
        # wave   cutoff  vol
        noise    f8      v7
        noise    fB      vC
        noise    fC      vF
        noise    fA      vB
        noise    f8      v6
    `,
});

/** The swish of a kick. It is fuller than a punch's, and lower and longer. */
export const KICK_SWISH = createSoundEffect({
    note: 'G-6',
    filter: 'b',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    priority: 0,
    maxVoices: 2,
    volume: 1,
    steps: `
        noise    f6      v6
        noise    f8      vA
        noise    fA      vD
        noise    fB      vF
        noise    fA      vD
        noise    f8      vA
        noise    f7      v6
        noise    f6      v3
    `,
});

/** The swish of a jump, a somersault or a flying kick. It is a long rush of air that rises and falls. */
export const LEAP_SWISH = createSoundEffect({
    note: 'E-6',
    filter: 'b',
    stepMs: 35,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 90 },
    priority: 0,
    maxVoices: 2,
    volume: 1,
    steps: `
        noise    f4      v4
        noise    f6      v7
        noise    f8      vA
        noise    fA      vD
        noise    fB      vF
        noise    fA      vD
        noise    f8      vA
        noise    f6      v7
        noise    f5      v4
        noise    f4      v2
    `,
});

/** The sound of a block, which is a dry, wooden clack. */
export const BLOCK = createSoundEffect({
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    priority: 1,
    maxVoices: 2,
    steps: `
        # wave      note   vol
        noise       C-7    vF
        triangle    A-5    vD
        triangle    F-5    v8
        triangle    D-5    v4
    `,
});

/** The sound of a blow that lands. It is a crack, then the thud of a fighter going down. */
export const HIT = createSoundEffect({
    note: 'C-3',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    priority: 2,
    maxVoices: 2,
    steps: `
        noise       +36   vF
        noise       +28   vF
        triangle    +12   vE
        triangle    +5    vD
        triangle    +0    vC
        triangle    -3    vA
        triangle    -5    v8
        noise       +7    vC
        triangle    -7    v8
        triangle    -9    v5
        triangle    -10   v2
    `,
});

/** The gong that starts a round. It is a metallic tone made of two waves combined, and it sinks a little as it rings. */
export const GONG = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw+pulse',
        pulseWidth: 0.3,
        envelope: { attackMs: 2, decayMs: 2200, sustain: 0, releaseMs: 400 },
        vibrato: { semitones: 0.12, hz: 4 },
        echo: 0.5,
    }),
    note: 'D-3',
    glideTo: 'C#3',
    lengthMs: 2200,
    priority: 3,
});

/** The short phrase played when the player scores a point. It is three rising notes. */
export const POINT_WON = createSoundEffect({
    note: 'A-5',
    stepMs: 90,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    echo: 0.4,
    priority: 3,
    volume: 0.49,
    steps: `
        pulse   +0    p4
        pulse   +7
        pulse   +12
    `,
});

/** The short phrase played when the opponent scores a point. It is three falling notes. */
export const POINT_LOST = createSoundEffect({
    note: 'E-5',
    stepMs: 110,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    echo: 0.4,
    priority: 3,
    volume: 0.49,
    steps: `
        pulse   +0    p8
        pulse   -5
        pulse   -11
    `,
});

/** A short, high tick, played in each of a round's last seconds. */
export const TICK = createSoundEffect({
    wave: 'pulse',
    pulseWidth: 0.25,
    note: 'E-6',
    envelope: { attackMs: 0, decayMs: 50, sustain: 0, releaseMs: 0 },
    lengthMs: 50,
    priority: 1,
    volume: 0.81,
});
