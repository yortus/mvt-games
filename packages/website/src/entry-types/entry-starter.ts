import type { Container, Renderer, Ticker } from 'pixi.js';
import type { View } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A loaded entry, ready to start. Its kind says how it runs. A `pixi` entry
 * draws on a stage that the host owns. An `element` entry brings its own
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
     * The play area, in the entry's own pixels. An entry that fits itself to
     * the area it is given (`fitTo`) makes these getters. Until it is fitted,
     * they give the play area it is designed around, as its metadata lists it.
     */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /**
     * Lays the entry out for an area of this size, in CSS pixels, and its play
     * area follows. It is for an entry whose layout follows the area it plays
     * in. The host calls it as it prepares the entry, and as the area changes,
     * then calls the session's `resize`. An entry without it plays at one
     * size, scaled to fit.
     */
    readonly fitTo?: (width: number, height: number) => void;
    /**
     * Whether it is drawn as pixel art. Pixel art has its textures scaled by
     * nearest neighbour, no antialiasing, and positions rounded to whole
     * pixels.
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
     * of it in action. It is called before each step of the advance, with the
     * time advanced so far. It presses or releases controls through the
     * session's `inputConfig`.
     */
    readonly thumbnailInput?: (session: EntrySession, elapsedMs: number) => void;
    /** Starts a session, adding the entry's view to `stage`. */
    readonly start: (options: PixiStartOptions) => EntrySession;
}

/** How to start a Pixi entry. */
export interface PixiStartOptions {
    /** The container to add the entry's view to. */
    readonly stage: Container;
    /** The application the entry runs in. Absent when it is started headless. */
    readonly host?: PixiHost;
    /**
     * The Audio80 that the entry's audio views play on. The host owns it and
     * resets it between sessions. It is silent when the entry is started
     * headless, or where audio cannot start.
     */
    readonly sound: Audio80;
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
 * host still drives its frames, in the MVT order. It calls the session's
 * `update`, then `updateView` and `refreshView` over its `views`, then its
 * `render`.
 */
export interface ElementEntryStarter {
    readonly kind: 'element';
    /** As for a Pixi entry: how long to advance before taking the thumbnail. */
    readonly thumbnailAdvanceMs?: number;
    /** Starts a session, building the entry inside `element`, which it fills. */
    readonly start: (options: ElementStartOptions) => ElementEntrySession;
}

/** How to start an element entry. */
export interface ElementStartOptions {
    /** The element to build the entry in. */
    readonly element: HTMLElement;
    /** The Audio80 that the entry's audio views play on, as for a Pixi entry. */
    readonly sound: Audio80;
}

/** A running entry. */
export interface EntrySession {
    /**
     * Advances the entry's models, and nothing else. The host updates and
     * refreshes the entry's views. Pausing is the host's call too. While
     * paused, the host calls neither this nor `updateView`.
     */
    readonly update: (deltaMs: number) => void;
    /** Lays the entry out again after its starter has been fitted to a new area (`fitTo`). */
    readonly resize?: () => void;
    /** Ends the session, and removes and destroys everything it made. */
    readonly destroy: () => void;
    /** The controls the entry takes, for the host's keyboard and touch input. Games have them. */
    readonly inputConfig?: EntryInputConfig;
}

/** A running element entry. */
export interface ElementEntrySession extends EntrySession {
    /**
     * The roots of the entry's views, of any renderer. They are each three.js
     * scene, Pixi stage and top-level element. The host ticks exactly these,
     * so the DOM views among them are left out of its walk of the page.
     */
    readonly views: readonly View[];
    /** Draws a frame with the entry's renderers, after the host has refreshed its views. */
    readonly render: () => void;
    /**
     * Settles once every renderer can draw, for an entry with one that starts
     * asynchronously (Pixi's `init`): a host taking a single picture (a
     * thumbnail, a visual test) waits for it. Absent when they all can at once.
     */
    readonly ready?: Promise<void>;
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
