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
    /** Create and start a running game session, mounting visuals on `stage`. */
    start(stage: Container): GameSession;
}

/** A running game instance — updated each tick and destroyable. */
export interface GameSession {
    /** Advance game state by the given elapsed milliseconds. */
    update(deltaMs: number): void;
    /** Tear down the game session and remove visuals from the stage. */
    destroy(): void;
}
