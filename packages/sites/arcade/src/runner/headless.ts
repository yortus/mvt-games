import type { Container } from 'pixi.js';
import type { HeadlessControls } from 'audio90/headless';
import { createHeadlessAudio80, createHeadlessAudio90 } from 'audio90/headless';
import { refreshView, updateView, type View } from '@mvtjs/html';
import {
    type ArcadeEntry, type EntrySession, type EntryStarter, type PixiEntryStarter, type SoundChipFinder,
    type SoundChipKind, type SoundChipsByKind, startPixiEntry,
} from '../entry-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The chip a session started headless plays on. It makes no sound. */
export interface HeadlessSound {
    /** Finds the chip, for the kind its starter names. */
    readonly findChip: SoundChipFinder;
    /** The chip's controls, or undefined for an entry that makes no sound, which is given no chip. */
    readonly controls: HeadlessControls | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StartPixiHeadlessOptions {
    readonly entry: ArcadeEntry;
    /** The entry's starter, which `ArcadeEntry.load` returns. */
    readonly starter: PixiEntryStarter;
    /** The bare container that the entry adds its view to. */
    readonly stage: Container;
    /** The chip that the entry plays on, from `createHeadlessSound`. */
    readonly sound: HeadlessSound;
}

export interface AdvanceHeadlessOptions {
    readonly session: EntrySession;
    /** The views that the host would tick. For a Pixi entry, that is its stage. */
    readonly views: readonly View[];
    /** The controls of the chip that the session plays on, if it plays on one. */
    readonly controls: HeadlessControls | undefined;
    readonly totalMs: number;
    /** Plays the entry's controls before each step, as `PixiEntryStarter.thumbnailInput` does. */
    readonly input?: (session: EntrySession, elapsedMs: number) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Creates the headless chip that `starter` plays on, which makes no sound,
 * and its controls. For an entry that makes no sound, it creates none.
 */
export function createHeadlessSound(starter: EntryStarter): HeadlessSound {
    switch (starter.soundChip) {
        case undefined:
            return { findChip: refuseChip, controls: undefined };
        case 'audio80': {
            const { audio80, controls } = createHeadlessAudio80();
            return { findChip: createChipFinder('audio80', audio80), controls };
        }
        case 'audio90': {
            const { audio90, controls } = createHeadlessAudio90();
            return { findChip: createChipFinder('audio90', audio90), controls };
        }
    }
}

/**
 * Starts a Pixi entry headless, on a bare container with no host. The
 * thumbnail page and the visual tests start entries this way. If the entry
 * lays itself out, it is laid out for the play area that its metadata
 * lists. A caller may already have fitted it to that size, and fitting it
 * again to the same size changes nothing.
 */
export function startPixiHeadless(options: StartPixiHeadlessOptions): EntrySession {
    const { entry, starter, stage, sound } = options;
    starter.fitTo?.(entry.screenWidth, entry.screenHeight);
    return startPixiEntry(starter, { stage }, sound.findChip);
}

/**
 * Waits until the browser has laid the page out and told any resize
 * observers the sizes they watch, as it does within an entry's first frames
 * on a real page. An element entry that sizes its drawing to its element,
 * through a `ResizeObserver`, learns its size only then. A headless run
 * advances every frame before the browser gets a turn, so it waits for this
 * first. A frame's callbacks run before its layout and its resize
 * observers, so it waits for the frame after.
 */
export async function waitForLayout(): Promise<void> {
    await waitForFrame();
    await waitForFrame();
}

/**
 * Advances a session by `totalMs`, in the order that the host uses. Each
 * frame-sized step plays the input, if any, then updates the session's
 * models, its chip's clock and its views, and refreshes the views. A
 * headless chip has no sound card to keep its time, so its clock moves with
 * the models. The steps are small because a model with phases or timelines
 * would skip what happens between them in one giant step. Each step
 * refreshes, as each frame does, because a refresh is where a view writes to
 * its chip: a music player sends the song it starts there, and the chip's
 * sequencer moves the song on from then.
 */
export function advanceHeadless(options: AdvanceHeadlessOptions): void {
    const { session, views, controls, totalMs, input } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        input?.(session, totalMs - remaining);
        session.update(step);
        controls?.update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        for (let i = 0; i < views.length; i++) refreshView(views[i]);
        remaining -= step;
    }
    // With no time to advance, the views still show where they start
    if (totalMs > 0) return;
    for (let i = 0; i < views.length; i++) refreshView(views[i]);
}

/**
 * Returns how long to advance an entry before its thumbnail is taken. That
 * is the time its starter asks for (`thumbnailAdvanceMs`), or one frame if
 * it asks for none.
 */
export function findThumbnailAdvanceMs(starter: EntryStarter): number {
    return starter.thumbnailAdvanceMs ?? FRAME_MS;
}

/** One frame at 60 frames a second, rounded down. */
export const FRAME_MS = 16;

function waitForFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** The chip finder for an entry that makes no sound. Its sessions are given no chip, so this is never called. */
function refuseChip(): never {
    throw new Error('headless: this entry makes no sound, so it has no chip');
}

/** Finds `chip`, the one chip made, for the kind `made`. Its starter names that kind, so no other is asked for. */
function createChipFinder<M extends SoundChipKind>(made: M, chip: SoundChipsByKind[M]): SoundChipFinder {
    return <K extends SoundChipKind>(kind: K) => {
        if ((kind as SoundChipKind) !== made) throw new Error(`headless: this entry plays on the ${made}, not the ${kind}`);
        // `kind` is `made`, which TypeScript can't follow into the chip's type
        return chip as unknown as SoundChipsByKind[K];
    };
}
