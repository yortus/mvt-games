import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Descriptor for a game that can be registered in the cabinet. */
export interface GameEntry {
    /** Unique identifier (e.g. 'pacman'). */
    readonly id: string;
    /** Human-readable display name (e.g. 'Pac-Man'). */
    readonly name: string;
    /** Desired canvas width in pixels. */
    readonly screenWidth: number;
    /** Desired canvas height in pixels. */
    readonly screenHeight: number;
    /**
     * Milliseconds to advance the model when generating a thumbnail.
     * Defaults to 16 ms (one tick). Games that need time for entities
     * to assemble (e.g. Galaga) can set a higher value.
     */
    readonly thumbnailAdvanceMs?: number;
    /**
     * Optional async hook called before `start()` to load assets
     * (e.g. sprite sheets). Games without assets may omit this.
     */
    preload?(): Promise<void>;
    /** Create and start a running game session, mounting visuals on `stage`. */
    start(stage: Container): GameSession;
}

/** A running game instance - updated each tick and destroyable. */
export interface GameSession {
    /** Advance game state by the given elapsed milliseconds. */
    update(deltaMs: number): void;
    /** Tear down the game session and remove visuals from the stage. */
    destroy(): void;
}
