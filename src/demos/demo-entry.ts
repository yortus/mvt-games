import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Descriptor for a demo that can be registered in the demos gallery. */
export interface DemoEntry {
    /** Unique identifier (e.g. 'tsx-pixi'). */
    readonly id: string;
    /** Human-readable display name. */
    readonly name: string;
    /** Short paragraph describing what the demo shows. */
    readonly description: string;
    /** Techniques and concepts demonstrated. */
    readonly techniques: readonly string[];
    /** URL to the source code (e.g. GitHub directory). */
    readonly sourceUrl?: string;
    /** Desired canvas width in pixels. */
    readonly screenWidth: number;
    /** Desired canvas height in pixels. */
    readonly screenHeight: number;
    /**
     * Milliseconds to advance the model when generating a thumbnail.
     * Defaults to 16 ms (one tick).
     */
    readonly thumbnailAdvanceMs?: number;
    /**
     * Optional async hook called before `start()` to load assets.
     */
    load?(): Promise<void>;
    /** Create and start a running demo session, mounting visuals on `stage`. */
    start(stage: Container): DemoSession;
}

/** A running demo instance - updated each tick and destroyable. */
export interface DemoSession {
    /** Advance demo state by the given elapsed milliseconds. */
    update(deltaMs: number): void;
    /** Tear down the demo session and remove visuals from the stage. */
    destroy(): void;
}
