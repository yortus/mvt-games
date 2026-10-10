import type { Container } from 'pixi.js';
import type { Audio80, AudioControls } from '@mvtjs/audio';
import { refreshView, updateView, type View } from '@mvtjs/html';
import type { ArcadeEntry, EntrySession, EntryStarter, PixiEntryStarter } from '../entry-types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StartPixiHeadlessOptions {
    readonly entry: ArcadeEntry;
    /** The entry's starter, which `ArcadeEntry.load` returns. */
    readonly starter: PixiEntryStarter;
    /** The bare container that the entry adds its view to. */
    readonly stage: Container;
    /** The chip that the entry plays on. A headless one makes no sound. */
    readonly sound: Audio80;
}

export interface AdvanceHeadlessOptions {
    readonly session: EntrySession;
    /** The views that the host would tick. For a Pixi entry, that is its stage. */
    readonly views: readonly View[];
    /** The controls of the chip that the session plays on. */
    readonly controls: AudioControls;
    readonly totalMs: number;
    /** Plays the entry's controls before each step, as `PixiEntryStarter.thumbnailInput` does. */
    readonly input?: (session: EntrySession, elapsedMs: number) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

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
    return starter.start({ stage, sound });
}

/**
 * Advances a session by `totalMs`, in the order that the host uses. Each
 * frame-sized step plays the input, if any, then updates the session's
 * models, its chip's clock and its views. At the end, the views are
 * refreshed once and the chip's writes are sent. The steps are small
 * because a model with phases or timelines would skip what happens between
 * them in one giant step.
 */
export function advanceHeadless(options: AdvanceHeadlessOptions): void {
    const { session, views, controls, totalMs, input } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        input?.(session, totalMs - remaining);
        session.update(step);
        controls.update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        remaining -= step;
    }
    for (let i = 0; i < views.length; i++) refreshView(views[i]);
    controls.flush();
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
