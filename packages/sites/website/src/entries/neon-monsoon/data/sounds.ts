import { createInstrument, createSoundEffect } from '@mvtjs/audio';

// These are Neon Monsoon's instruments and sound effects, for the Audio80.
// All were written for this game. The arcades of the 1990s had FM chips and
// samples, which this chip lacks. So it comes nearer the softer sound of that
// decade by other means than its square waves. It uses wavetables drawn from
// FM tones (a sine bent by a second sine, at a low index), saws through a
// low-pass filter, slow attacks, gentle vibrato, and the echo on almost
// everything.

// ---------------------------------------------------------------------------
// Wavetables
// ---------------------------------------------------------------------------

/** An electric piano's tone: a sine, with a little of its second and third harmonics. */
const EPIANO_WAVE = '8ACE FFFE DDCB BA98 8765 4432 2100 0135';
/** A bell: a sine bent at three times its pitch, as a two-operator FM voice would. */
const BELL_WAVE = '7CEF FEDD DFFD A766 7998 5200 2221 0013';
/** A plain sine, for soft sweeps and sparkles. */
const SINE_WAVE = '89AC DEEF FFEE DCA9 8653 2110 0011 2356';

// ---------------------------------------------------------------------------
// The tunes' instruments
// ---------------------------------------------------------------------------

/** The lead: a saw through filter `b`, slow to speak, with a delayed vibrato and the echo behind it. */
export const LEAD = createInstrument({
    wave: 'saw',
    filter: 'b',
    envelope: { attackMs: 25, decayMs: 400, sustain: 0.7, releaseMs: 220 },
    vibrato: { semitones: 0.18, hz: 5.5, delayMs: 220 },
    echo: 0.4,
    volume: 0.55,
});

/** The bell, which plays the chords as arpeggios. It gives the music the decade's shimmer. */
export const BELLS = createInstrument({
    wave: 'wavetable',
    wavetable: BELL_WAVE,
    envelope: { attackMs: 2, decayMs: 380, sustain: 0.25, releaseMs: 200 },
    stepMs: 50,
    echo: 0.5,
    volume: 0.45,
});

/** Long notes on the electric piano, for the slower tunes. */
export const EPIANO = createInstrument({
    wave: 'wavetable',
    wavetable: EPIANO_WAVE,
    envelope: { attackMs: 3, decayMs: 900, sustain: 0.35, releaseMs: 400 },
    vibrato: { semitones: 0.08, hz: 4.5, delayMs: 300 },
    echo: 0.45,
    volume: 0.7,
});

/** The bass: a saw through filter `a`, the filter closing on each note. */
export const BASS = createInstrument({
    wave: 'saw',
    filter: 'a',
    filterSweep: { fromHz: 1600, toHz: 260, ms: 180 },
    envelope: { attackMs: 2, decayMs: 220, sustain: 0.45, releaseMs: 60 },
    volume: 0.8,
});

/** A kick: a triangle dropping fast. */
export const KICK = createInstrument({
    note: 'C-2',
    stepMs: 12,
    envelope: { attackMs: 0, decayMs: 190, sustain: 0, releaseMs: 0 },
    steps: `
        # wave     pitch
        triangle   +24
        triangle   +14
        triangle   +7
        triangle   +3
        triangle   +0
        triangle   -3
    `,
});

/** A snare: a crack of noise over a short, low body. */
export const SNARE = createInstrument({
    note: 'D-5',
    stepMs: 20,
    envelope: { attackMs: 0, decayMs: 170, sustain: 0, releaseMs: 0 },
    echo: 0.15,
    volume: 0.6,
    steps: `
        # wave     pitch   vol
        noise      +0      vF
        triangle   -24     vC
        noise      +0      vB
    `,
});

/** A closed hat: a tick of high noise. */
export const HAT = createInstrument({
    wave: 'noise',
    note: 'C-7',
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 0 },
    volume: 0.22,
});

// ---------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------

/** The guns' soft, short blip, quiet under everything else. It plays at half the rate of the volleys while the ship flies. */
export const SHOT = createSoundEffect({
    note: 'A-5',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 25 },
    priority: 0,
    volume: 0.42,
    steps: `
        # wave   pitch  vol  width
        pulse    +12    vC   p3
        pulse    +5     v9
        pulse    +0     v6
        pulse    -4     v3
    `,
});

/** The guns, focused: lower and narrower, a tick more than a blip. */
export const FOCUSED_SHOT = createSoundEffect({
    note: 'E-5',
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 25 },
    priority: 0,
    volume: 0.42,
    steps: `
        pulse    +7     vC   p2
        pulse    +0     v8
        pulse    -5     v4
    `,
});

/** Slowing to focus: a soft sine, falling. */
export const FOCUS = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: SINE_WAVE,
        envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 60 },
    }),
    note: 'E-5',
    glideTo: 'E-4',
    lengthMs: 90,
    priority: 1,
    volume: 0.5,
});

/** A bullet grazed: a tiny, high bell. */
export const GRAZE = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: BELL_WAVE,
        envelope: { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 },
    }),
    note: 'E-7',
    lengthMs: 60,
    priority: 0,
    volume: 0.45,
});

/** The ship hit: a long, falling crash, ringing in the echo. */
export const SHIP_EXPLODE = createSoundEffect({
    note: 'C-4',
    stepMs: 60,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 500 },
    echo: 0.5,
    priority: 3,
    steps: `
        noise      +19   vF
        saw        +12   vE
        noise      +12   vE
        noise      +7    vD
        noise      +3    vB
        noise      +0    v9
        noise      -3    v7
        noise      -6    v5
        noise      -9    v3
    `,
});

/** The ship coming back: a sine rising, with a shimmer. */
export const RESPAWN = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: SINE_WAVE,
        envelope: { attackMs: 60, decayMs: 0, sustain: 1, releaseMs: 300 },
        vibrato: { semitones: 0.25, hz: 9 },
        echo: 0.5,
    }),
    note: 'D-4',
    glideTo: 'D-6',
    lengthMs: 600,
    priority: 3,
    volume: 0.8,
});

/** A bomb: a rush of noise swelling and dying, over a low sine falling away. */
export const BOMB = createSoundEffect({
    note: 'C-4',
    stepMs: 80,
    envelope: { attackMs: 20, decayMs: 0, sustain: 1, releaseMs: 600 },
    echo: 0.4,
    priority: 3,
    steps: `
        noise      +12   v8
        noise      +16   vC
        noise      +19   vF
        noise      +14   vF
        noise      +10   vE
        noise      +6    vC
        noise      +3    vA
        noise      +0    v8
        noise      -3    v6
        noise      -6    v4
    `,
});

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

/** A power-up: the electric piano, up a major chord and on. */
export const POWER_UP = createSoundEffect({
    note: 'C-5',
    stepMs: 45,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    echo: 0.4,
    priority: 2,
    volume: 0.7,
    wave: 'wavetable',
    wavetable: EPIANO_WAVE,
    steps: `
        wavetable  +0
        wavetable  +4
        wavetable  +7
        wavetable  +12
        wavetable  +16
    `,
});

/** A bomb picked up: the same, lower, on a fourth. */
export const BOMB_PICKUP = createSoundEffect({
    note: 'G-4',
    stepMs: 45,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    echo: 0.4,
    priority: 2,
    volume: 0.7,
    wave: 'wavetable',
    wavetable: EPIANO_WAVE,
    steps: `
        wavetable  +0
        wavetable  +5
        wavetable  +7
        wavetable  +12
    `,
});

/** A gem collected: a quick sparkle on the sine, a fifth up. */
export const GEM = createSoundEffect({
    note: 'B-6',
    stepMs: 25,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 70 },
    priority: 0,
    maxVoices: 2,
    volume: 0.42,
    wave: 'wavetable',
    wavetable: SINE_WAVE,
    steps: `
        wavetable  +0
        wavetable  +7
    `,
});

/** An extra life: bells, up two octaves, ringing on. */
export const EXTEND = createSoundEffect({
    instrument: createInstrument({
        wave: 'wavetable',
        wavetable: BELL_WAVE,
        envelope: { attackMs: 0, decayMs: 900, sustain: 0, releaseMs: 300 },
        arpeggio: [0, 7, 12, 16, 19, 24],
        stepMs: 60,
        echo: 0.5,
    }),
    note: 'D-5',
    lengthMs: 700,
    priority: 3,
    volume: 0.8,
});

// ---------------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------------

/** A small craft destroyed: a short burst of noise, falling. */
export const EXPLODE_SMALL = createSoundEffect({
    note: 'C-4',
    stepMs: 30,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    echo: 0.2,
    priority: 1,
    maxVoices: 2,
    volume: 0.7,
    steps: `
        noise   +17   vF
        noise   +12   vD
        noise   +8    vA
        noise   +5    v7
        noise   +2    v4
    `,
});

/** A barge destroyed: deeper and longer, with a thump. */
export const EXPLODE_LARGE = createSoundEffect({
    note: 'C-3',
    stepMs: 45,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    echo: 0.3,
    priority: 2,
    maxVoices: 2,
    steps: `
        noise      +19   vF
        triangle   +0    vF
        noise      +12   vE
        noise      +8    vC
        noise      +5    vA
        noise      +2    v7
        noise      +0    v4
    `,
});

/** A gunship, or the boss, destroyed: a long roar, sinking, ringing out. */
export const EXPLODE_HUGE = createSoundEffect({
    note: 'C-3',
    stepMs: 70,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 700 },
    echo: 0.55,
    priority: 3,
    steps: `
        noise      +19   vF
        triangle   +0    vF
        noise      +14   vF
        noise      +10   vE
        noise      +7    vD
        noise      +4    vB
        noise      +2    v9
        noise      +0    v7
        noise      -2    v5
        noise      -4    v3
    `,
});

// ---------------------------------------------------------------------------
// The boss
// ---------------------------------------------------------------------------

/** The boss's warning, which sounds again and again while it shows. It is a saw that swells up an octave, through the echo. */
export const WARNING = createSoundEffect({
    instrument: createInstrument({
        wave: 'saw',
        envelope: { attackMs: 120, decayMs: 0, sustain: 1, releaseMs: 200 },
        echo: 0.4,
    }),
    note: 'A-3',
    glideTo: 'A-4',
    lengthMs: 550,
    priority: 3,
    volume: 0.55,
});

/** The boss taking hits. It is a quiet metal tick, played again and again while the shots land. */
export const BOSS_HIT = createSoundEffect({
    instrument: createInstrument({
        wave: 'noise',
        envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 0 },
    }),
    note: 'A-6',
    lengthMs: 35,
    priority: 0,
    volume: 0.4,
});

/** One of the boss's attacks ending, broken or timed out. Bells tumble down over a crash. */
export const ATTACK_BROKEN = createSoundEffect({
    note: 'E-6',
    stepMs: 50,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 400 },
    echo: 0.55,
    priority: 3,
    volume: 0.8,
    wavetable: BELL_WAVE,
    steps: `
        noise      +12   vF
        wavetable  +0    vE
        wavetable  -5    vD
        wavetable  -8    vC
        wavetable  -12   vB
        wavetable  -17   v9
        wavetable  -20   v7
        wavetable  -24   v5
    `,
});
