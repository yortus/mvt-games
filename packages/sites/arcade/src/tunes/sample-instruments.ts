import { createAudio90Instrument } from '@mvtjs/chiptune';
import {
    BREAK, CHOIR, MOD_BASS_SAMPLE, MOD_HAT_SAMPLE, MOD_KICK_SAMPLE, MOD_LEAD_SAMPLE, MOD_SNARE_SAMPLE, ORCHESTRA_HIT, STRINGS_SAMPLE,
} from './samples';

// The instruments that play the samples. They are apart from
// the other instruments, which the samples are bounced from.

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

/** The orchestra hit, played back from its sample, at any pitch. */
export const HIT = createAudio90Instrument({
    engine: 'sample',
    sample: ORCHESTRA_HIT,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 150 },
    volume: 0.9,
    reverb: 0.3,
});

/** The break, which a song plays slice by slice with `s`. */
export const BREAKBEAT = createAudio90Instrument({
    engine: 'sample',
    sample: BREAK,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 },
    volume: 1,
    note: 'C-4',
});

/** The choir's "aah", looping back and forth while it is held. */
export const AAH = createAudio90Instrument({
    engine: 'sample',
    sample: CHOIR,
    envelope: { attackMs: 120, decayMs: 0, sustain: 1, releaseMs: 700 },
    volume: 0.55,
    chorus: 0.3,
    reverb: 0.5,
});

/** Sampled strings, as a 16-bit console played them, in its soft echo. */
export const SAMPLED_STRINGS = createAudio90Instrument({
    engine: 'sample',
    sample: STRINGS_SAMPLE,
    envelope: { attackMs: 60, decayMs: 0, sustain: 1, releaseMs: 500 },
    volume: 0.55,
    echo: 0.3,
    reverb: 0.3,
});

// ---------------------------------------------------------------------------
// The Amiga module's instruments
// ---------------------------------------------------------------------------

/** The module's bass, from its looped saw. */
export const MOD_BASS = createAudio90Instrument({
    engine: 'sample',
    sample: MOD_BASS_SAMPLE,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    volume: 0.6,
});

/** The module's lead, from its looped pulse, with the vibrato the trackers gave a held note. */
export const MOD_LEAD = createAudio90Instrument({
    engine: 'sample',
    sample: MOD_LEAD_SAMPLE,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 60 },
    vibrato: { semitones: 0.25, hz: 6, delayMs: 200 },
    volume: 0.45,
});

/** The module's chords: the lead's sample, played as fast arpeggios, quieter. */
export const MOD_CHORD = createAudio90Instrument({
    engine: 'sample',
    sample: MOD_LEAD_SAMPLE,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    stepMs: 40,
    volume: 0.3,
});

/** The module's drums, played back at their own pitch. */
export const MOD_KICK = createAudio90Instrument({ engine: 'sample', sample: MOD_KICK_SAMPLE, note: 'C-4', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 }, volume: 0.9 });
export const MOD_SNARE = createAudio90Instrument({ engine: 'sample', sample: MOD_SNARE_SAMPLE, note: 'C-4', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 }, volume: 0.7 });
export const MOD_HAT = createAudio90Instrument({ engine: 'sample', sample: MOD_HAT_SAMPLE, note: 'C-4', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 }, volume: 0.5 });
