import { createAudio90Sound } from 'audio90';

// The game's sound effects, for the Audio90. All were written for this game.
// They are earthy, to suit a labyrinth of sandstone and clay. Sand shuffles
// as you lay the thread, bricks clack as you build a wall, and a trumpet
// sounds when you escape. They are short and soft, since a puzzle is played
// in quiet. Each passage laid is played a step higher than the last, chosen
// by the audio view, so a long stroke climbs as the thread grows.

/**
 * The sound of a passage laid, a short, dry shuffle of sand. It's white
 * noise through a band filter that follows the note the audio view chooses,
 * so the shuffle rises with each step. A fast, random wobble in its level
 * makes it gritty.
 */
export const STEPPED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 1100, resonance: 0.2, keyTrack: 0.6 },
    lfo: { shape: 'random', rateHz: 90, volume: 0.6 },
    envelope: { attackMs: 12, decayMs: 85, sustain: 0, releaseMs: 35 },
    note: 'C-5',
    lengthMs: 80,
    priority: 1,
    volume: 4.4,
});

/**
 * The sound of a wall built, two quick clacks of clay. They sound like a
 * brick set down on another, the second a little lower as it settles. Each
 * clack is a short knock that falls in pitch, with a burst of filtered noise
 * for the grit of the brick. A step doesn't restart the volume envelope, so
 * the step table shapes each clack with its own volumes.
 */
export const WALLED = createAudio90Sound({
    oscillator: { wave: 'triangle' },
    noise: 0.7,
    filter: { mode: 'bandpass', cutoffHz: 1200, resonance: 0.3 },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 10 },
    note: 'D-5',
    stepMs: 12,
    steps: `
        # pitch  vol
          +7     vF
          +2     v8
          +0     v3
          +0     v1
          +0     v0
          +3     vC
          -2     v6
          -4     v2
          -4     v0
    `,
    lengthMs: 110,
    priority: 1,
    volume: 1.55,
});

/** A mark rubbed out: a brief brush of soft noise, like an eraser on paper. */
export const RUBBED = createAudio90Sound({
    oscillator: { unison: 0 },
    noise: 1,
    filter: { mode: 'bandpass', cutoffHz: 2800 },
    envelope: { attackMs: 10, decayMs: 70, sustain: 0, releaseMs: 30 },
    lengthMs: 70,
    priority: 1,
    volume: 2.4,
});

/**
 * The sound of a mark that breaks a rule, two low, muffled knocks, the second
 * lower. A step doesn't restart the volume envelope, so the step table
 * shapes each knock with its own volumes.
 */
export const CLASHED = createAudio90Sound({
    oscillator: { wave: 'pulse' },
    filter: { mode: 'lowpass12', cutoffHz: 550 },
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    note: 'G-3',
    stepMs: 17,
    steps: `
        # pitch  vol
          +0     vF
          +0     v9
          +0     v4
          +0     v1
          +0     v0
          -3     vF
          -3     v9
          -3     v4
          -3     v1
          -3     v0
    `,
    lengthMs: 170,
    priority: 2,
    volume: 0.7,
});

/** A stroke taken back: a short blip that slides down, as if run backwards. */
export const UNDONE = createAudio90Sound({
    oscillator: { wave: 'sine' },
    envelope: { attackMs: 15, decayMs: 50, sustain: 0, releaseMs: 20 },
    note: 'A-5',
    glideTo: 'D-5',
    lengthMs: 60,
    priority: 1,
    volume: 0.9,
});

/**
 * The sound of the maze escaped, a trumpet call. It climbs a major chord,
 * steps back, and climbs again to hold its top note, ringing in a hall. The
 * trumpet is two saws a hair apart, under a filter that opens at the start
 * of each note, the way brass brightens as it's blown harder. A step
 * doesn't restart the envelopes, so the step table shapes each note with
 * its own volumes and filter settings, and each note fades a little before
 * the next, as a trumpeter tongues it. A little vibrato comes in on the held
 * note.
 */
export const SOLVED = createAudio90Sound({
    oscillator: { wave: 'saw', unison: 2, detune: 0.06, spread: 0.3 },
    filter: { mode: 'lowpass12', cutoffHz: 2600, keyTrack: 0.3 },
    envelope: { attackMs: 15, decayMs: 0, sustain: 1, releaseMs: 260 },
    vibrato: { semitones: 0.18, hz: 5.5, delayMs: 850 },
    note: 'G-4',
    stepMs: 35,
    steps: `
        # pitch  vol  cutoff
          +0     vF   fF
          +0     vD   fC
          +0     vB   fA
          +0     v7   f8
          +5     vF   fF
          +5     vD   fC
          +5     vB   fA
          +5     v7   f8
          +9     vF   fF
          +9     vD   fC
          +9     vB   fA
          +9     v7   f8
          +5     vF   fF
          +5     vD   fC
          +5     vB   fA
          +5     v7   f8
          +9     vF   fF
          +9     vD   fC
          +9     vB   fA
          +9     v7   f8
          +12    vF   fF
          +12    vE   fD
    `,
    lengthMs: 1500,
    priority: 2,
    volume: 0.4,
    reverb: 0.35,
});
