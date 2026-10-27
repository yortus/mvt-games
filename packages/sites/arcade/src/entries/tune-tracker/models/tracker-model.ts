// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Tune Tracker: which tune is chosen, whether it plays, and for how
 * long. Where the tune is, row by row, is the chip's, which plays it for
 * the views: the model only says what should be playing.
 */
export interface TrackerModel {
    readonly tuneCount: number;
    /** The tune chosen, from 0. It plays while `isPlaying`. */
    readonly tuneIndex: number;
    readonly isPlaying: boolean;
    /** How many times a tune has started from its beginning. Each rise is one more start. */
    readonly starts: number;
    /** How long the tune has played since it last started, in ms. 0 while nothing plays. */
    readonly playedMs: number;

    /** Chooses tune `index`. If a tune is playing, the new one starts. */
    chooseTune: (index: number) => void;
    /** Chooses tune `index` and starts it, even if it is the one playing. */
    playTune: (index: number) => void;
    /** Moves the choice by `step`, round and round. */
    moveChoice: (step: number) => void;
    /** Starts the tune chosen, or stops it if it is playing. */
    playOrStop: () => void;
    /** Stops the tune playing, if one is. */
    stop: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TrackerModelOptions {
    /** How many tunes there are, 1 or more. */
    readonly tuneCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a tracker with the first tune chosen, and nothing playing. */
export function createTrackerModel(options: TrackerModelOptions): TrackerModel {
    const { tuneCount } = options;
    let tuneIndex = 0;
    let isPlaying = false;
    let starts = 0;
    let playedMs = 0;

    const model: TrackerModel = {
        tuneCount,
        get tuneIndex() {
            return tuneIndex;
        },
        get isPlaying() {
            return isPlaying;
        },
        get starts() {
            return starts;
        },
        get playedMs() {
            return playedMs;
        },

        chooseTune(index) {
            if (!isIndex(index, tuneCount) || index === tuneIndex) return;
            tuneIndex = index;
            if (isPlaying) start();
        },

        playTune(index) {
            if (!isIndex(index, tuneCount)) return;
            tuneIndex = index;
            start();
        },

        moveChoice(step) {
            model.chooseTune(wrap(tuneIndex + step, tuneCount));
        },

        playOrStop() {
            if (isPlaying) model.stop();
            else start();
        },

        stop() {
            isPlaying = false;
            playedMs = 0;
        },

        update(deltaMs) {
            if (isPlaying) playedMs += deltaMs;
        },
    };
    return model;

    function start(): void {
        isPlaying = true;
        starts++;
        playedMs = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isIndex(index: number, count: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < count;
}

/** `index` brought round into 0 to `count` - 1. */
function wrap(index: number, count: number): number {
    return ((index % count) + count) % count;
}
