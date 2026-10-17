import { createAudio90SoundEffect } from '@mvtjs/chiptune';
import { STORM_HIT } from './instruments';

// These are Neon Monsoon's sound effects, for the Audio90. All were written
// for this game. Each plays where it happens: the game's audio view pans it
// by its place across the arena when it plays. So the sounds are mono, and
// the echo and the reverb give them room. The explosions are white noise
// alone, through a gentle filter that falls from bright, with no resonance
// to give them a pitch, the bigger ones rumbling roughly down. Each effect's
// volume sets its loudness against the music's, the guns' and the grazes'
// quiet, as they repeat, the explosions' and the pickups' loud.

// ---------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------

/** The guns' soft tick, dark and quiet under everything else. It plays at half the rate of the volleys while the ship flies. */
export const SHOT = createAudio90SoundEffect({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 1400 },
    envelope: { attackMs: 0, decayMs: 45, sustain: 0, releaseMs: 15 },
    note: 'E-5',
    glideTo: 'B-4',
    lengthMs: 40,
    priority: 0,
    volume: 1.32,
});

/** The guns, focused: lower and shorter, a tick more than a blip. */
export const FOCUSED_SHOT = createAudio90SoundEffect({
    oscillator: { wave: 'triangle' },
    filter: { mode: 'lowpass12', cutoffHz: 1100 },
    envelope: { attackMs: 0, decayMs: 35, sustain: 0, releaseMs: 15 },
    note: 'B-4',
    glideTo: 'F#4',
    lengthMs: 30,
    priority: 0,
    volume: 1.36,
});

/** Slowing to focus: a soft sine, falling an octave. */
export const FOCUS = createAudio90SoundEffect({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 60 },
    note: 'E-5',
    glideTo: 'E-4',
    lengthMs: 90,
    priority: 1,
    volume: 1.03,
});

/** A bullet grazed: a tiny, high bell. */
export const GRAZE = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 80, sustain: 0, releaseMs: 30 } },
        { ratio: 3.5, level: 0.8, envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 20 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 30 },
    note: 'E-7',
    lengthMs: 60,
    priority: 0,
    volume: 1.13,
    reverb: 0.2,
});

/** The ship hit: a long roar of white noise, falling darker, rumbling roughly down, ringing in the echo. */
export const SHIP_EXPLODE = createAudio90SoundEffect({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 900, envelope: { octaves: 3, decayMs: 1100, releaseMs: 500 } },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 500 },
    stepMs: 65,
    steps: `
        vF
        vE
        vF
        vD
        vC
        vD
        vB
        vA
        vB
        v9
        v8
        v7
        v6
        v5
        v4
        v3
        v2
        v1
    `,
    priority: 3,
    volume: 5.89,
    echo: 0.3,
    reverb: 0.4,
});

/** The ship coming back: a sine rising two octaves, with a shimmer. */
export const RESPAWN = createAudio90SoundEffect({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 60, decayMs: 0, sustain: 1, releaseMs: 300 },
    vibrato: { semitones: 0.25, hz: 9 },
    note: 'D-4',
    glideTo: 'D-6',
    lengthMs: 600,
    priority: 3,
    volume: 1.16,
    echo: 0.4,
});

/** A bomb: a rush of white noise swelling as its filter opens, then rumbling away as it closes. */
export const BOMB = createAudio90SoundEffect({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 700, envelope: { octaves: 3.5, attackMs: 250, decayMs: 1100, releaseMs: 500 } },
    envelope: { attackMs: 60, decayMs: 1800, sustain: 0, releaseMs: 500 },
    lengthMs: 1200,
    priority: 3,
    volume: 6.31,
    reverb: 0.5,
});

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

/** A power-up: an electric piano, up a major chord and on. */
export const POWER_UP = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 1, decayMs: 600, sustain: 0.3, releaseMs: 200 } },
        { level: 0.5, envelope: { attackMs: 0, decayMs: 300, sustain: 0.1, releaseMs: 100 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    note: 'C-5',
    stepMs: 45,
    steps: `
        +0
        +4
        +7
        +12
        +16
    `,
    priority: 2,
    volume: 2.54,
    echo: 0.35,
});

/** A bomb picked up: the same, lower, on a fourth. */
export const BOMB_PICKUP = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 1, decayMs: 600, sustain: 0.3, releaseMs: 200 } },
        { level: 0.5, envelope: { attackMs: 0, decayMs: 300, sustain: 0.1, releaseMs: 100 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 200 },
    note: 'G-4',
    stepMs: 45,
    steps: `
        +0
        +5
        +7
        +12
    `,
    priority: 2,
    volume: 2.49,
    echo: 0.35,
});

/** A gem collected: a quick sparkle on a sine, a fifth up. */
export const GEM = createAudio90SoundEffect({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 70 },
    note: 'B-6',
    stepMs: 25,
    steps: `
        +0
        +7
    `,
    priority: 0,
    maxVoices: 2,
    volume: 0.79,
});

/** An extra life: bells, up two octaves, ringing on. */
export const EXTEND = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 900, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 1, envelope: { attackMs: 0, decayMs: 500, sustain: 0, releaseMs: 200 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    arpeggio: [0, 7, 12, 16, 19, 24],
    stepMs: 60,
    note: 'D-5',
    lengthMs: 700,
    priority: 3,
    volume: 2.34,
    echo: 0.4,
    reverb: 0.3,
});

// ---------------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------------

/**
 * A small craft destroyed, the commonest sound in the game: a soft hiss of
 * white noise, its lowest frequencies cut so it does not thud, fading in
 * over a few milliseconds rather than struck, and kept quiet under the rest.
 */
export const EXPLODE_SMALL = createAudio90SoundEffect({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'highpass', cutoffHz: 700 },
    envelope: { attackMs: 8, decayMs: 320, sustain: 0, releaseMs: 80 },
    lengthMs: 250,
    priority: 1,
    maxVoices: 2,
    volume: 0.68,
    reverb: 0.1,
});

/** A barge destroyed: a longer burst of white noise, rumbling roughly down as it darkens. */
export const EXPLODE_LARGE = createAudio90SoundEffect({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 1200, envelope: { octaves: 2.5, decayMs: 600, releaseMs: 250 } },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 250 },
    stepMs: 45,
    steps: `
        vF
        vD
        vE
        vB
        vC
        v9
        vA
        v7
        v8
        v5
        v6
        v4
        v3
        v2
        v1
    `,
    priority: 2,
    maxVoices: 2,
    volume: 5.89,
    reverb: 0.25,
});

/** A gunship, or the boss, destroyed: a long roar of white noise, rumbling roughly down, ringing out. */
export const EXPLODE_HUGE = createAudio90SoundEffect({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 800, envelope: { octaves: 3, decayMs: 1200, releaseMs: 500 } },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 500 },
    stepMs: 70,
    steps: `
        vF
        vE
        vF
        vD
        vE
        vC
        vD
        vB
        vC
        vA
        vB
        v9
        v8
        v9
        v7
        v6
        v5
        v4
        v3
        v2
        v1
    `,
    priority: 3,
    volume: 5.89,
    echo: 0.2,
    reverb: 0.45,
});

// ---------------------------------------------------------------------------
// The boss
// ---------------------------------------------------------------------------

/** The boss's warning, which sounds again and again while it shows: the orchestra hit, in the reverb. */
export const WARNING = createAudio90SoundEffect({
    instrument: STORM_HIT,
    note: 'A-3',
    lengthMs: 600,
    priority: 3,
    volume: 7.85,
    reverb: 0.4,
});

/** The boss taking hits. It is a quiet metal tick, played again and again while the shots land. */
export const BOSS_HIT = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 10 } },
        { ratio: 7.5, level: 2, envelope: { attackMs: 0, decayMs: 25, sustain: 0, releaseMs: 10 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 },
    note: 'A-5',
    lengthMs: 35,
    priority: 0,
    volume: 1.34,
});

/** One of the boss's attacks ending, broken or timed out: bells tumbling down, in the echo. */
export const ATTACK_BROKEN = createAudio90SoundEffect({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 600, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 1.1, envelope: { attackMs: 0, decayMs: 300, sustain: 0, releaseMs: 200 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 400 },
    note: 'E-6',
    stepMs: 50,
    steps: `
        +0
        -5
        -8
        -12
        -17
        -20
        -24
    `,
    priority: 3,
    volume: 2.79,
    echo: 0.45,
    reverb: 0.3,
});
