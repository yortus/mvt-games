// What every chip uses: what every chip has, and its playing members, the
// layout of a stamped command, the buffer a writer fills and the queue a
// synthesiser keeps, the messages to a worklet, note names, the note driver,
// the voice chooser, the song player, and the tracker notation's grammar.

export { type ChipPlayback, type ChipPlaybackOptions, createChipPlayback } from './chip-playback';
export { chooseSoundVoice, type SoundVoices } from './choose-sound-voice';
export { createCommandQueue, type CommandQueue, type CommandQueueOptions } from './command-queue';
export { type CommandBuffer, type CommandBufferOptions, createCommandBuffer } from './command-buffer';
export { type CommandWriter, type CommandWriterOptions, createCommandWriter } from './command-writer';
export { ASAP_STAMP, COMMAND_STRIDE, OP_PLAY, OP_PLAY_OPTIONS, OP_RELEASE_ALL, OP_STOP } from './commands';
export {
    createNoteDriver, DEFAULT_STEP_MS, type DriverSound, type DriverStep, MAX_ARPEGGIO, type NoteDriver, type NoteDriverOptions,
    type StepPitchMode,
} from './note-driver';
export { type AnyPlayOptions, checkPlay, type CheckedPlay, HELD_LENGTH, NO_GLIDE, type PlayDefaults, writePlay } from './play-options';
export { clampVolume, joinMembers, type SongSequencer, type SoundChip } from './sound-chip';
export {
    createScope,
    createScopeTargets,
    registerScopeSource,
    type Scope,
    SCOPE_POINTS,
    SCOPE_STRIDE,
    type ScopeSource,
    type ScopeTargets,
    toScopeLength,
} from './scope';
export { createSongPlayer, type PlayableSong, type SongDriver, type SongPlayer, type SongWriter, type SoundIds } from './song-player';
export { toFrequency, HIGHEST_NOTE, HIGHEST_NOTE_NAME, LN_SEMITONE, LOWEST_NOTE, toNoteName, toNoteNumber } from './notes';
export {
    checkInstrumentLetters,
    checkLoop,
    checkTempo,
    computeSongDurationMs,
    isNoteInRange,
    parseHexToken,
    parseOrder,
    parseRelativePitch,
    type SongOrderEntry,
    type SongTempo,
    type SongTiming,
    splitCells,
    splitRows,
    splitTokens,
} from './tracker';
