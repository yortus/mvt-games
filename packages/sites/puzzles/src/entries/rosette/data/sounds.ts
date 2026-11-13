import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game.
// They are soft and short, like small pieces of glass, since a puzzle is
// played in quiet. Only a piece that joins the locked pieces sounds
// different: one put in its place elsewhere sounds like any other swap, or
// the sound would give the puzzle away.

/** Two pieces swapped: a light clink of glass, its overtones out of tune with its note, as a struck pane's are. */
export const SWAPPED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 260, sustain: 0, releaseMs: 120 } },
        { ratio: 3.5, level: 0.38, envelope: { attackMs: 0, decayMs: 70, sustain: 0, releaseMs: 30 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 120 },
    note: 'E-6',
    lengthMs: 140,
    priority: 1,
    volume: 0.6,
});

/**
 * Pieces joining the locked ones: a soft, bright two-note chime, a fourth
 * up, as the pieces lift and settle into the frame. Fuller than a swap's
 * clink, quieter than the solved chime.
 */
export const LOCKED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 420, sustain: 0, releaseMs: 160 } },
        { ratio: 2, level: 0.32, envelope: { attackMs: 0, decayMs: 160, sustain: 0, releaseMs: 80 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 160 },
    note: 'B-5',
    stepMs: 70,
    steps: `
        +0
        +5
    `,
    lengthMs: 260,
    priority: 1,
    volume: 1,
    echo: 0.2,
});

/** A swap taken back: a short blip that slides down, as if run backwards. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 15, decayMs: 50, sustain: 0, releaseMs: 20 },
    note: 'A-5',
    glideTo: 'D-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.9,
});

/** The picture whole again: glassy bells climbing a major ninth chord, ringing on in the echo, as the light sweeps across. */
export const SOLVED = createAudio90Sound({
    engine: 'fm',
    algorithm: '2>1',
    operators: [
        { envelope: { attackMs: 0, decayMs: 700, sustain: 0, releaseMs: 300 } },
        { ratio: 3.5, level: 0.3, envelope: { attackMs: 0, decayMs: 200, sustain: 0, releaseMs: 120 } },
    ],
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
    note: 'D-5',
    stepMs: 95,
    steps: `
        +0
        +7
        +11
        +14
        +16
        +19
        +23
        +26
    `,
    lengthMs: 950,
    priority: 2,
    volume: 1.45,
    echo: 0.35,
});
