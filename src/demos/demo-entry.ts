import type { Container, Renderer, Ticker } from 'pixi.js';

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
     * Optional async method called before `start()` to load assets.
     */
    load?(): Promise<void>;
    /**
     * Create and start a running demo session, mounting visuals on `stage`.
     * `host` is given when the demo runs in the gallery's runner, and not when
     * it is started headless (e.g. to render a thumbnail).
     */
    start(stage: Container, host?: DemoHost): DemoSession;
}

/** The application a demo runs in, for demos that measure or extend it. */
export interface DemoHost {
    readonly renderer: Renderer;
    /** Drives the demo: each tick runs the session's `update`, then refreshes and renders the stage. */
    readonly ticker: Ticker;
}

/** A running demo instance - updated each tick and destroyable. */
export interface DemoSession {
    /** Advance demo state by the given elapsed milliseconds. */
    update(deltaMs: number): void;
    /**
     * Re-layout after a viewport size change.
     * Called by the runner after resizing the Pixi renderer.
     */
    resize?(): void;
    /** Tear down the demo session and remove visuals from the stage. */
    destroy(): void;
}
