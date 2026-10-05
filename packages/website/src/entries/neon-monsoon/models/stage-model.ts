import { assert } from '@mvtjs/utils';
import type { StageEvent } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The stage's clock and its script. Stage time runs from 0; the city scrolls
 * at a steady speed until the boss arrives, and the events in the script come
 * due as stage time passes.
 */
export interface StageModel {
    /** Milliseconds since the stage started. */
    readonly timeMs: number;
    /** How far the ship has flown over the city, in world-units. */
    readonly scrollY: number;
    /** World-units per second; 0 once the boss has arrived. */
    readonly scrollSpeed: number;
    /**
     * Hands out the script's events in order, each once, as their time comes.
     *
     * Returns the next event whose `atMs` stage time has reached, and moves
     * the script on past it, so the next call returns the event after it.
     * Returns undefined when the next event is not due yet, or none are left.
     * Call it until it returns undefined to get every event due by now:
     *
     * ```ts
     * for (let event = stage.consumeNextDueEvent(); event !== undefined; event = stage.consumeNextDueEvent()) {
     *     run(event);
     * }
     * ```
     *
     * Consuming the boss's event also stops the scroll.
     */
    consumeNextDueEvent: () => StageEvent | undefined;
    /** Back to the start of the stage, for a new game or the next loop. */
    restart: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StageModelOptions {
    /** Sorted by `atMs`. */
    readonly events: readonly StageEvent[];
    readonly scrollSpeed: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStageModel(options: StageModelOptions): StageModel {
    const { events } = options;
    assert(isSortedByTime(events), 'stage: events must be sorted by atMs');

    let timeMs = 0;
    let scrollY = 0;
    let scrollSpeed = options.scrollSpeed;
    let nextEvent = 0;

    const model: StageModel = {
        get timeMs() {
            return timeMs;
        },
        get scrollY() {
            return scrollY;
        },
        get scrollSpeed() {
            return scrollSpeed;
        },

        consumeNextDueEvent() {
            if (nextEvent === events.length || events[nextEvent].atMs > timeMs) return undefined;
            const event = events[nextEvent++];
            if (event.kind === 'boss') scrollSpeed = 0;
            return event;
        },

        restart() {
            timeMs = 0;
            scrollY = 0;
            scrollSpeed = options.scrollSpeed;
            nextEvent = 0;
        },

        update(deltaMs) {
            timeMs += deltaMs;
            scrollY += scrollSpeed * deltaMs * 0.001;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isSortedByTime(events: readonly StageEvent[]): boolean {
    for (let i = 1; i < events.length; i++) {
        if (events[i].atMs < events[i - 1].atMs) return false;
    }
    return true;
}
