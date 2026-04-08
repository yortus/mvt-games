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
     * When true, the desktop scaler snaps to integer multiples (1x, 2x, 3x...)
     * for crisp pixel-art rendering. Defaults to false (smooth scaling).
     */
    readonly integerScale?: boolean;
    /**
     * Optional play instructions shown via the pause menu's
     * "How to Play" button. Games without instructions may omit this.
     */
    readonly instructions?: string;
    /**
     * Optional async hook called before `start()` to load assets
     * (e.g. sprite sheets). Games without assets may omit this.
     */
    load?(): Promise<void>;
    /** Create and start a running game session, mounting visuals on `stage`. */
    start(stage: Container): GameSession;
}

/** Input configuration provided by a game session. */
export interface GameInputConfig {
    showDpad?: boolean;
    showPrimary?: boolean;
    showSecondary?: boolean;
    primaryLabel?: string;
    secondaryLabel?: string;
    floatingJoystick?: boolean;
    onXDirectionChanged?(direction: 'left' | 'none' | 'right'): void;
    onYDirectionChanged?(direction: 'up' | 'none' | 'down'): void;
    onPrimaryButtonChanged?(pressed: boolean): void;
    onSecondaryButtonChanged?(pressed: boolean): void;
    onRestartButtonChanged?(pressed: boolean): void;
}

/** A running game instance - updated each tick and destroyable. */
export interface GameSession {
    /** Advance game state by the given elapsed milliseconds. */
    update(deltaMs: number): void;
    /** Tear down the game session and remove visuals from the stage. */
    destroy(): void;
    /** Input control configuration for the game. */
    inputConfig?: GameInputConfig;
}
