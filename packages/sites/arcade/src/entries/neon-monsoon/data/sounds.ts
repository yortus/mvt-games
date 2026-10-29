import { type Audio90Sound, createAudio90Sound } from 'audio90';
import { STORM_HIT_OPTIONS } from './instruments';

// These are Neon Monsoon's sound effects, for the Audio90. All were written
// for this game. Each plays where it happens: the game's audio view pans it
// by its place across the arena when it plays. So the sounds are mono, and
// the echo and the reverb give them room. The explosions are white noise
// alone, through a gentle filter that falls from bright, with no resonance
// to give them a pitch, the bigger ones rumbling roughly down. Each effect's
// volume sets its loudness against the music's, the guns', the charging
// tone's and the lock's ticks quiet, as they repeat, the explosions' and the pickups' loud.

// ---------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------

/** The guns' soft tick, dark and quiet under everything else. It plays at half the rate of the volleys while the ship flies. */
export const SHOT = createAudio90Sound({
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
export const FOCUSED_SHOT = createAudio90Sound({
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
export const FOCUS = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 60 },
    note: 'E-5',
    glideTo: 'E-4',
    lengthMs: 90,
    priority: 1,
    volume: 1.03,
});

// ---------------------------------------------------------------------------
// The volley
// ---------------------------------------------------------------------------

/**
 * The volley's bar filling: a soft tone, played again and again while the
 * ship is near bullets, so it sounds on for as long as the bar fills. Each
 * tone is a semitone above the one before, from an empty bar at the first
 * to a full bar two octaves up at the last, so the tone rises as the bar
 * fills.
 */
/** How many semitones the charging tone rises from an empty bar to a full one. It is set before the tones are made from it. */
const CHARGE_TONE_SEMITONES = 24;
export const CHARGE_TONES: readonly Audio90Sound[] = createChargeTones();

/** The volley's ring forming around the ship: a quick sine, sweeping up an octave. */
export const RING_UP = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 10, decayMs: 0, sustain: 1, releaseMs: 120 },
    note: 'E-5',
    glideTo: 'E-6',
    lengthMs: 140,
    priority: 2,
    volume: 1.13,
    echo: 0.2,
});

/** A shot of the ring stopping a bullet: a bright metal tink. */
export const SHIELD_HIT = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 140, sustain: 0, releaseMs: 40 } },
        { ratio: 5.5, level: 1.2, envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 30 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    note: 'B-6',
    lengthMs: 60,
    priority: 2,
    maxVoices: 2,
    volume: 2.48,
});

/** The volley's bar full: two bells, up a fifth, ringing in the echo. */
export const VOLLEY_CHARGED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 400, sustain: 0, releaseMs: 150 } },
        { ratio: 3.5, level: 0.9, envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 100 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    note: 'B-5',
    stepMs: 70,
    steps: `
        +0
        +7
    `,
    lengthMs: 200,
    priority: 2,
    volume: 2.4,
    echo: 0.3,
});

/** The lock closing: a tiny, bright tick, played faster and faster as the lock closes. */
export const LOCK_TICK = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 3000 },
    envelope: { attackMs: 0, decayMs: 30, sustain: 0, releaseMs: 10 },
    note: 'A-6',
    lengthMs: 25,
    priority: 1,
    volume: 2.07,
});

/** The lock complete: a crisp chirp, up an octave. */
export const LOCKED = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 4000 },
    envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 40 },
    note: 'E-6',
    stepMs: 40,
    steps: `
        +0
        +12
    `,
    lengthMs: 120,
    priority: 2,
    volume: 2.88,
});

/** The volley released: a rush of white noise, opening and closing, in the echo. */
export const VOLLEY_LAUNCH = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1200 },
    modEnvelope: { to: 'cutoff', amount: 2, envelope: { attackMs: 150, decayMs: 300, sustain: 0, releaseMs: 100 } },
    envelope: { attackMs: 30, decayMs: 450, sustain: 0, releaseMs: 100 },
    lengthMs: 350,
    priority: 2,
    volume: 11.1,
    echo: 0.3,
});

/** The volley bursting on its target: a bright crackle of white noise, falling darker. */
export const VOLLEY_BURST = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 2500 },
    modEnvelope: { to: 'cutoff', amount: 2, envelope: { attackMs: 0, decayMs: 350, sustain: 0, releaseMs: 150 } },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    stepMs: 30,
    steps: `
        vF
        vB
        vE
        v9
        vC
        v7
        v9
        v5
        v6
        v3
        v2
        v1
    `,
    priority: 3,
    volume: 5.5,
    reverb: 0.3,
});

/** The ship hit: a long roar of white noise, falling darker, rumbling roughly down, ringing in the echo. */
export const SHIP_EXPLODE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 900 },
    modEnvelope: { to: 'cutoff', amount: 3, envelope: { attackMs: 0, decayMs: 1100, sustain: 0, releaseMs: 500 } },
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
export const RESPAWN = createAudio90Sound({
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
export const BOMB = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 700 },
    modEnvelope: { to: 'cutoff', amount: 3.5, envelope: { attackMs: 250, decayMs: 1100, sustain: 0, releaseMs: 500 } },
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
export const POWER_UP = createAudio90Sound({
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
export const BOMB_PICKUP = createAudio90Sound({
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
export const GEM = createAudio90Sound({
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
export const EXTEND = createAudio90Sound({
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
export const EXPLODE_SMALL = createAudio90Sound({
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
export const EXPLODE_LARGE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 1200 },
    modEnvelope: { to: 'cutoff', amount: 2.5, envelope: { attackMs: 0, decayMs: 600, sustain: 0, releaseMs: 250 } },
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
export const EXPLODE_HUGE = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'lowpass12', cutoffHz: 800 },
    modEnvelope: { to: 'cutoff', amount: 3, envelope: { attackMs: 0, decayMs: 1200, sustain: 0, releaseMs: 500 } },
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
export const WARNING = createAudio90Sound({
    ...STORM_HIT_OPTIONS,
    note: 'A-3',
    lengthMs: 600,
    priority: 3,
    volume: 5.495,
    reverb: 0.4,
});

/** The boss taking hits. It is a quiet metal tick, played again and again while the shots land. */
export const BOSS_HIT = createAudio90Sound({
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
export const ATTACK_BROKEN = createAudio90Sound({
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createChargeTones(): Audio90Sound[] {
    const tones: Audio90Sound[] = [];
    for (let step = 0; step <= CHARGE_TONE_SEMITONES; step++) {
        tones.push(createAudio90Sound({
            oscillator: { wave: 'triangle' },
            filter: { mode: 'lowpass12', cutoffHz: 3000 },
            envelope: { attackMs: 5, decayMs: 0, sustain: 1, releaseMs: 25 },
            note: 'C-5',
            stepMs: 50,
            steps: `+${step}`,
            lengthMs: 50,
            priority: 1,
            volume: 1.25,
        }));
    }
    return tones;
}
