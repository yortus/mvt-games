import type { ArcadeEntry } from '../entries';
import { createEntryHost, type EntryHost } from './entry-host';
import { isTouchDevice } from './is-touch-device';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EntryPageOptions {
    /** The entry to run. */
    readonly entry: ArcadeEntry;
    /** The element it fills, which must be positioned. */
    readonly element: HTMLElement;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Runs one entry as a page of its own: loads it, starts it in `element`, and
 * drives its frames from the page's one loop until the page closes.
 */
export async function runEntryPage(options: EntryPageOptions): Promise<EntryHost> {
    const { entry, element } = options;
    const host = createEntryHost({ element, isTouch: isTouchDevice() });
    const starter = await entry.load();
    await host.prepare(starter);
    host.start(starter);

    let lastTimeMs: number | undefined;
    requestAnimationFrame(frame);
    return host;

    function frame(timeMs: number): void {
        // A long gap (a hidden tab) is clamped rather than simulated
        const deltaMs = lastTimeMs === undefined ? 0 : Math.min(timeMs - lastTimeMs, MAX_STEP_MS);
        lastTimeMs = timeMs;
        host.tick(timeMs, deltaMs);
        requestAnimationFrame(frame);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_STEP_MS = 50;
