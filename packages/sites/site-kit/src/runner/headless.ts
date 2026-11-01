import type { Container } from 'pixi.js';
import { createHeadlessAudio80, createHeadlessAudio90, type HeadlessAudio80, type HeadlessAudio90 } from 'audio90/headless';
import { refreshView, updateView, type View } from '@mvtjs/html';
import {
    type ArcadeEntry, type EntrySession, type EntryStarter, type PixiEntryStarter, type SoundChipFinder,
    type SessionChips, type SoundChipKind, startPixiEntry,
} from '../entry-types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The chips a session started headless plays on, one for its music and one for its sound effects. They make no sound. */
export interface HeadlessSound {
    /** Finds the chips, for the kind its starter names. */
    readonly findChips: SoundChipFinder;
    /** The chips, which an entry that makes no sound is given none of. */
    readonly chips: readonly (HeadlessAudio80 | HeadlessAudio90)[];
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
    /** The chips that the entry plays on, from `createHeadlessSound`. */
    readonly sound: HeadlessSound;
}

export interface AdvanceHeadlessOptions {
    readonly session: EntrySession;
    /** The views that the host would tick. For a Pixi entry, that is its stage. */
    readonly views: readonly View[];
    /** The chips that the session plays on, if any. */
    readonly chips: readonly (HeadlessAudio80 | HeadlessAudio90)[];
    readonly totalMs: number;
    /** Plays the entry's controls before each step, as `PixiEntryStarter.thumbnailInput` does. */
    readonly input?: (session: EntrySession, elapsedMs: number) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Creates the headless chips that `starter` plays on, which make no sound.
 * For an entry that makes no sound, it creates none.
 */
export function createHeadlessSound(starter: EntryStarter): HeadlessSound {
    switch (starter.soundChip) {
        case undefined:
            return { findChips: refuseChips, chips: [] };
        case 'audio80': {
            const chips = { music: createHeadlessAudio80(), sfx: createHeadlessAudio80() };
            return { findChips: createChipFinder('audio80', chips), chips: [chips.music, chips.sfx] };
        }
        case 'audio90': {
            const chips = { music: createHeadlessAudio90(), sfx: createHeadlessAudio90() };
            return { findChips: createChipFinder('audio90', chips), chips: [chips.music, chips.sfx] };
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
    return startPixiEntry(starter, { stage }, sound.findChips);
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
 * its chip: it plays a song there, and the chip's sequencer moves the song on
 * from then.
 */
export function advanceHeadless(options: AdvanceHeadlessOptions): void {
    const { session, views, chips, totalMs, input } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        input?.(session, totalMs - remaining);
        session.update(step);
        for (let i = 0; i < chips.length; i++) chips[i].update(step);
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

/** The chip finder for an entry that makes no sound. Its sessions are given no chips, so this is never called. */
function refuseChips(): never {
    throw new Error('headless: this entry makes no sound, so it has no chips');
}

/** Finds `chips`, the chips made, for the kind `made`. Its starter names that kind, so no other is asked for. */
function createChipFinder<M extends SoundChipKind>(made: M, chips: SessionChips<M>): SoundChipFinder {
    return <K extends SoundChipKind>(kind: K) => {
        if ((kind as SoundChipKind) !== made) throw new Error(`headless: this entry plays on the ${made}, not the ${kind}`);
        // `kind` is `made`, which TypeScript can't follow into the chips' type
        return chips as unknown as SessionChips<K>;
    };
}
