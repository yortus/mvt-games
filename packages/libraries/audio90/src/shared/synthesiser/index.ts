// The parts every chip's synthesiser is built from: its queue of commands,
// its envelopes, its note driver, its voices' plays, and the maths it shares.

export { type CommandScheduler, type CommandSchedulerOptions, createCommandScheduler } from './command-scheduler';
export { createEnvelopes, ENV_IDLE, ENV_RELEASE, type Envelopes, type EnvelopesOptions, type EnvelopeTimes } from './envelopes';
export { createNoteDriver, DEFAULT_STEP_MS, type DriverSound, type DriverStep, MAX_ARPEGGIO, type NoteDriver, type NoteDriverOptions, type StepPitchMode } from './note-driver';
export { createSoundPlays, type SoundPlays, type SoundPlaysOptions, type SoundVoices } from './sound-plays';
export { clamp, clearTinyValues, computeFall, CONTROL_SAMPLES, DC_POLE, MAX_CUTOFF_SHARE, MAX_ECHO_FEEDBACK, MIN_CUTOFF_HZ, polyBlep, SVF_A1, SVF_A2, SVF_A3, SVF_K, SVF_STRIDE, TINY, tuneStateVariableFilter } from './synthesis';
