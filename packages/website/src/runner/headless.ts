import type { Container } from 'pixi.js';
import { refreshView, updateView, type View } from '@mvtjs/html';
import type { ArcadeEntry, EntrySession, EntryStarter, PixiEntryStarter } from '../entry-types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StartPixiHeadlessOptions {
    readonly entry: ArcadeEntry;
    /** The entry's starter, from `entry.load()`. */
    readonly starter: PixiEntryStarter;
    /** The bare container the entry adds its view to. */
    readonly stage: Container;
}

export interface AdvanceHeadlessOptions {
    readonly session: EntrySession;
    /** The views the host would tick: a Pixi entry's stage, or an element session's `views`. */
    readonly views: readonly View[];
    readonly totalMs: number;
    /** Played before each step, with the time advanced so far: a starter's `thumbnailInput`. */
    readonly input?: (session: EntrySession, elapsedMs: number) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Starts a Pixi entry headless: on a bare container, with no host, as
 * thumbnails and visual tests do. An entry that lays itself out is laid
 * out for the play area its metadata lists (again, if the caller already
 * fitted it to size something by it: the same size changes nothing).
 */
export function startPixiHeadless(options: StartPixiHeadlessOptions): EntrySession {
    const { entry, starter, stage } = options;
    starter.fitTo?.(entry.screenWidth, entry.screenHeight);
    return starter.start({ stage });
}

/**
 * Advances a session as the host would, in frame-sized steps: before each,
 * the input (if any) is played, then the session's models are updated, then
 * its views'. At the end, the views are refreshed once. The steps are small
 * because models with phases or timelines are not leap-safe: one giant step
 * would skip what happens between.
 */
export function advanceHeadless(options: AdvanceHeadlessOptions): void {
    const { session, views, totalMs, input } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        input?.(session, totalMs - remaining);
        session.update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        remaining -= step;
    }
    for (let i = 0; i < views.length; i++) refreshView(views[i]);
}

/** How long an entry is advanced before its thumbnail is taken: as long as it asks, or one frame. */
export function thumbnailMomentOf(starter: EntryStarter): number {
    return starter.thumbnailAdvanceMs ?? FRAME_MS;
}

/** One frame at 60 frames a second, rounded down. */
export const FRAME_MS = 16;
