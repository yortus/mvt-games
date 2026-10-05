import type { Container, Renderer, Ticker } from 'pixi.js';
import type { View } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A loaded entry, ready to start. Its kind says how it runs: a `pixi` entry
 * draws on a stage the host owns, and an `element` entry brings its own
 * renderers and mounts into an element.
 */
export type EntryStarter = PixiEntryStarter | ElementEntryStarter;

/**
 * An entry drawn with Pixi on the host's stage. The host owns the Pixi
 * application, scales the play area to fit, draws touch controls around it,
 * and pauses the entry by leaving its container out of `updateView`. It can
 * also start the entry headless, on a bare container, as thumbnails and
 * benchmarks do.
 */
export interface PixiEntryStarter {
    readonly kind: 'pixi';
    /**
     * The play area, in the entry's own pixels. Getters, when it follows the
     * viewport (`fitsViewport`).
     */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /**
     * Whether the play area follows the viewport: the host reads its size again,
     * and calls the session's `resize`, when the viewport changes.
     */
    readonly fitsViewport?: boolean;
    /**
     * Whether it is drawn as pixel art: textures scaled by nearest neighbour,
     * no antialiasing, and positions rounded to whole pixels.
     */
    readonly pixelArt?: boolean;
    /** Whether a desktop host scales by whole numbers only (1x, 2x, 3x...), for crisp pixel art. */
    readonly integerScale?: boolean;
    /**
     * How long to advance the entry before taking its thumbnail. Defaults to
     * one frame. An entry that takes a while to assemble asks for more.
     */
    readonly thumbnailAdvanceMs?: number;
    /**
     * Plays the entry's controls while its thumbnail is set up, for a picture
     * of it in action: called before each step of the advance, with the time
     * advanced so far, to press or release controls through the session's
     * `inputConfig`.
     */
    readonly thumbnailInput?: (session: EntrySession, elapsedMs: number) => void;
    /** Starts a session, adding the entry's view to `stage`. */
    readonly start: (options: PixiStartOptions) => EntrySession;
}

export interface PixiStartOptions {
    readonly stage: Container;
    /** The application the entry runs in. Absent when it is started headless. */
    readonly host?: PixiHost;
}

/** The Pixi application an entry runs in, for entries that measure it (`createPerformanceMetrics`). */
export interface PixiHost {
    readonly renderer: Renderer;
    /** Steps once per frame, before the stage is updated, refreshed and rendered. */
    readonly ticker: Ticker;
}

/**
 * An entry that brings its own renderers (three.js, a Pixi application, the
 * DOM, or several at once) and mounts into an element the host gives it. The
 * host still drives its frames, in the MVT order: the session's `update`,
 * then `updateView` and `refreshView` over its `views`, then its `render`.
 */
export interface ElementEntryStarter {
    readonly kind: 'element';
    /** As for a Pixi entry: how long to advance before taking the thumbnail. */
    readonly thumbnailAdvanceMs?: number;
    /** Starts a session, building the entry inside `element`, which it fills. */
    readonly start: (options: ElementStartOptions) => ElementEntrySession;
}

export interface ElementStartOptions {
    readonly element: HTMLElement;
}

/** A running entry. */
export interface EntrySession {
    /**
     * Advances the entry's models. Models only: the host updates and refreshes
     * the entry's views. Pausing is the host's call too: while paused, it calls
     * neither this nor `updateView`.
     */
    readonly update: (deltaMs: number) => void;
    /** Lays the entry out again after the viewport changes. */
    readonly resize?: () => void;
    /** Ends the session, and removes and destroys everything it made. */
    readonly destroy: () => void;
    /** The controls the entry takes, for the host's keyboard and touch input. Games have them. */
    readonly inputConfig?: EntryInputConfig;
}

/** A running element entry. */
export interface ElementEntrySession extends EntrySession {
    /**
     * The roots of the entry's views, of any renderer: each three.js scene,
     * Pixi stage and top-level element. The host ticks exactly these, so the
     * DOM views among them are left out of its walk of the page.
     */
    readonly views: readonly View[];
    /** Draws a frame with the entry's renderers, after the host has refreshed its views. */
    readonly render: () => void;
}

/** The controls an entry takes, and where the host reports them. */
export interface EntryInputConfig {
    readonly showDpad?: boolean;
    readonly showPrimary?: boolean;
    readonly showSecondary?: boolean;
    readonly primaryLabel?: string;
    readonly secondaryLabel?: string;
    readonly floatingJoystick?: boolean;
    readonly onXDirectionChanged?: (direction: 'left' | 'none' | 'right') => void;
    readonly onYDirectionChanged?: (direction: 'up' | 'none' | 'down') => void;
    readonly onPrimaryButtonChanged?: (pressed: boolean) => void;
    readonly onSecondaryButtonChanged?: (pressed: boolean) => void;
    readonly onRestartButtonChanged?: (pressed: boolean) => void;
}
