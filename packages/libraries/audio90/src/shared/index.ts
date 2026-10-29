// What every chip uses: what every chip has, and its playing members, the
// layout of a stamped command, the buffer a writer fills, the messages to a
// worklet, note names, the song player, and the tracker notation (its cells,
// and how songs and their tokens are parsed); and the parts of every chip's
// synthesiser: its queue of commands, its envelopes, its note driver, its
// voices' plays, and the maths it shares.

export { type ChipPlayback, type ChipPlaybackOptions, createChipPlayback } from './chip-playback';
export { type CommandScheduler, type CommandSchedulerOptions, createCommandScheduler } from './command-scheduler';
export { type CommandBuffer, type CommandBufferOptions, createCommandBuffer } from './command-buffer';
export { type CommandWriter, type CommandWriterOptions, createCommandWriter } from './command-writer';
export {
    ASAP_STAMP, COMMAND_STRIDE, OP_NOTE_OFF, OP_NOTE_ON, OP_PLAY, OP_PLAY_OPTIONS, OP_RELEASE_ALL, OP_SET_VOICE, OP_STOP,
} from './commands';
export {
    createEnvelopes, ENV_IDLE, ENV_RELEASE, type Envelopes, type EnvelopesOptions, type EnvelopeTimes,
} from './envelopes';
export {
    createNoteDriver, DEFAULT_STEP_MS, type DriverSound, type DriverStep, MAX_ARPEGGIO, type NoteDriver, type NoteDriverOptions,
    type StepPitchMode,
} from './note-driver';
export { type AnyPlayOptions, checkPlay, type CheckedPlay, type PlayDefaults, writePlay } from './play-options';
export { clampVolume, joinMembers, type SongSequencer, type SoundChip } from './sound-chip';
export {
    createScopeTargets,
    findScopeSource,
    registerScopeSource,
    SCOPE_POINTS,
    SCOPE_STRIDE,
    type ScopeSource,
    type ScopeTargets,
    toScopeLength,
} from './scope-source';
export { createSoundPlays, type SoundPlays, type SoundPlaysOptions, type SoundVoices } from './sound-plays';
export { createSongPlayer, type PlayableSong, type SongDriver, type SongPlayer, type SongWriter, type SoundIds } from './song-player';
export { toFrequency, HIGHEST_NOTE, LN_SEMITONE, LOWEST_NOTE, toNoteName, toNoteNumber } from './notes';
export {
    clamp,
    clearTinyValues,
    computeFall,
    CONTROL_SAMPLES,
    DC_POLE,
    MAX_CUTOFF_SHARE,
    MAX_ECHO_FEEDBACK,
    MIN_CUTOFF_HZ,
    polyBlep,
    SVF_A1,
    SVF_A2,
    SVF_A3,
    SVF_K,
    SVF_STRIDE,
    TINY,
    tuneStateVariableFilter,
} from './synthesis';
export {
    CELL_ARPEGGIO,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    type CellGrammar,
    type CellToken,
    COMMON_CELL_TOKENS,
    DEFAULT_VIBRATO,
    NO_NOTE,
    RELEASE,
} from './cell-grammar';
export { parseHexToken } from './parse-hex-token';
export { parseNote } from './parse-note';
export { parseNoteToken } from './parse-note-token';
export { parseRelativePitch } from './parse-relative-pitch';
export { parseSongCore, type SongChip } from './parse-song-core';
export { printHexToken } from './print-hex-token';
export type { SongCore, SongCoreOptions, SongOrderEntry, SongPattern } from './song-core';
export { splitRows } from './split-rows';
export { splitTokens } from './split-tokens';
