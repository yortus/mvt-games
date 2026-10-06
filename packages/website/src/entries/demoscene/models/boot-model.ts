import { BOOT_COMMAND } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The steps of the boot screen, in order. */
export type BootPhaseKind = 'ready' | 'typing' | 'searching' | 'found' | 'loading' | 'blank';

/** Part 0: a boot screen types a command, finds the demo, and loads it with stripes in the border. */
export interface BootModel {
    readonly phase: BootPhaseKind;
    /** How many characters of the command have been typed. */
    readonly typedCount: number;
    /** The cursor blinks while the machine waits. */
    readonly isCursorOn: boolean;
    /** Whole 50 Hz frames since loading began, which the loading stripes change on. 0 before. */
    readonly loadingFrame: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BootModelOptions {
    /** Milliseconds into the part. */
    readonly elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBootModel(options: BootModelOptions): BootModel {
    const { elapsedMs } = options;

    return {
        get phase() {
            const t = elapsedMs();
            if (t < TYPING_MS) return 'ready';
            if (t < SEARCHING_MS) return 'typing';
            if (t < FOUND_MS) return 'searching';
            if (t < LOADING_MS) return 'found';
            if (t < BLANK_MS) return 'loading';
            return 'blank';
        },
        get typedCount() {
            const typed = Math.floor((elapsedMs() - TYPING_MS) / MS_PER_KEY) + 1;
            return typed < 0 ? 0 : typed > BOOT_COMMAND.length ? BOOT_COMMAND.length : typed;
        },
        get isCursorOn() {
            return Math.floor(elapsedMs() / CURSOR_BLINK_MS) % 2 === 0;
        },
        get loadingFrame() {
            const t = elapsedMs() - LOADING_MS;
            return t < 0 ? 0 : Math.floor(t / PAL_FRAME_MS);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** When each phase starts, in milliseconds into the part, which lasts 7680 ms (four bars). */
const TYPING_MS = 1300;
const SEARCHING_MS = 2800;
const FOUND_MS = 3500;
const LOADING_MS = 4200;
const BLANK_MS = 7200;

/** Typing speed: the command takes about 1.3 seconds. */
const MS_PER_KEY = 80;

const CURSOR_BLINK_MS = 320;

/** A frame of the PAL machine, which ran at 50 Hz. */
const PAL_FRAME_MS = 20;
