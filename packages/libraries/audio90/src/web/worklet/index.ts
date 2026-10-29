// What runs on the audio thread: each chip's processor and runner, the
// worklet's clock and sequencer, and the messages the page sends them. The
// page imports only types and names from here. It loads each processor by
// its URL, with `?worker&url`, so the worklet's code never joins the page's.

export { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings } from './audio80-runner';
export { type Audio90PassedMessage, AUDIO90_PROCESSOR_NAME, type Audio90RunnerSettings } from './audio90-runner';
export type { PassedMessage, RunnerMessage, ScopeReply } from './chip-runner';
export type { SongCall, SongMessage, SongPlaceReply } from './song-messages';
