import type { Container } from 'pixi.js';
import type { MetricKind, View } from '@mvtjs/pixi';
import type { Audio80, Audio90 } from 'audio90';
import type { MusicChip, SfxChip } from '#shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A loaded entry, ready to start. Its kind says how it runs. A `pixi` entry
 * draws on a stage that the host owns. An `element` entry brings its own
 * renderers and mounts into an element.
 */
export type EntryStarter = PixiEntryStarter | ElementEntryStarter;

/** The sound chips an entry can play on. */
export type SoundChipKind = 'audio80' | 'audio90';

/** The chip of each kind. */
export interface SoundChipsByKind {
    readonly audio80: Audio80;
    readonly audio90: Audio90;
}

/** The two chips of kind `K` that a session plays on: one for its music, and one for its sound effects. */
export interface SessionChips<K extends SoundChipKind> {
    readonly music: SoundChipsByKind[K];
    readonly sfx: SoundChipsByKind[K];
}

/** The chip a starter plays on, or undefined for a starter that makes no sound. */
export type SoundChoice = SoundChipKind | undefined;

/**
 * What a starter says about its sound. A starter that plays on a chip names
 * it, and one that makes no sound names none.
 */
export type SoundChipField<K extends SoundChoice> = K extends SoundChipKind ? HasSoundChip<K> : HasNoSoundChip;

/** A starter that plays on chip `K`. */
export interface HasSoundChip<K extends SoundChipKind> {
    /**
     * The kind of chip the entry's audio views play on. The host loads two of
     * them as it prepares the entry, and gives them to each session as
     * `music` and `sfx`.
     */
    readonly soundChip: K;
}

/**
 * A starter's `soundChip`, as `definePixiLoader` reads it to work out `K`:
 * the chip it names, or none.
 */
export interface NamedSoundChip<K extends SoundChoice> {
    readonly soundChip?: K;
}

/** A starter that makes no sound. */
export interface HasNoSoundChip {
    /** Absent, since the entry makes no sound. Its sessions are given no chips. */
    readonly soundChip?: undefined;
}

/** The `music` and `sfx` start options that go with a starter's chip. A starter that makes no sound is given neither. */
export type SoundOption<K extends SoundChoice> = K extends SoundChipKind ? GivenSound<K> : GivenNoSound;

/**
 * The start options of a session that plays on chips of kind `K`. The host
 * owns both chips, pauses them with the game, and stops everything on them
 * between sessions. They are silent when the entry is started headless, or
 * where audio cannot start.
 */
export interface GivenSound<K extends SoundChipKind> {
    /** The chip that the entry's views play music on, at the listener's music volume. */
    readonly music: MusicChip<K>;
    /** The chip that the entry's views play sound effects on, at the listener's sound effects volume. */
    readonly sfx: SfxChip<K>;
}

/** The start options of a session that makes no sound. */
export interface GivenNoSound {
    /** Absent, since the entry makes no sound. */
    readonly music?: undefined;
    /** Absent, since the entry makes no sound. */
    readonly sfx?: undefined;
}

/** Finds the chips of a kind, for a session that plays on them. */
export type SoundChipFinder = <K extends SoundChipKind>(kind: K) => SessionChips<K>;

/**
 * An entry drawn with Pixi on the host's stage, which plays on chips of kind
 * `K`, or makes no sound. Without `K`, it is any Pixi entry, and TypeScript
 * tells them apart by `soundChip`. An entry makes its `load` with
 * `definePixiLoader`, which works out `K` from the `soundChip` its starter
 * names, so that the `music` and `sfx` its sessions are given are of that
 * kind.
 */
export type PixiEntryStarter<K extends SoundChoice = SoundChoice> = K extends unknown
    ? PixiEntryStarterFields<K> & SoundChipField<K>
    : never;

/**
 * What every Pixi entry's starter has. The host owns the Pixi application,
 * scales the play area to fit, draws touch controls around it, and pauses the
 * entry by leaving its container out of `updateView`. It can also start the
 * entry headless, on a bare container, as thumbnails and benchmarks do.
 */
export interface PixiEntryStarterFields<K extends SoundChoice> {
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
    /**
     * The metrics the Arcade's Perfmon can't measure honestly while the entry
     * runs, which it shows as n/a. For example, `reads`, for an entry whose
     * views draw by hand and don't count their reads (`addReads`). None by
     * default.
     */
    readonly unmeasuredMetrics?: readonly MetricKind[];
    /** Starts a session, adding the entry's view to `stage`. */
    readonly start: (options: PixiStartOptions<K>) => EntrySession;
}

/** How to start a Pixi entry that plays on chip `K`, or makes no sound. */
export type PixiStartOptions<K extends SoundChoice> = PixiStartBase & SoundOption<K>;

/** How to start a Pixi entry, but for its sound. */
export interface PixiStartBase extends StartOptions {
    /** The container to add the entry's view to. */
    readonly stage: Container;
    /**
     * Whether the entry plays in the Arcade's page, whose URL it may read and
     * change. Absent when it is started headless, as thumbnails, visual tests
     * and benchmarks do.
     */
    readonly isInPage?: boolean;
}

/** What the host gives an entry of either kind as it starts. */
export interface StartOptions {
    /**
     * For a game with a highscore table: the best score in it, for a HUD's
     * "HI". 0 while the table is empty, loading or out of reach. Absent when
     * the game is started headless, or outside the Arcade.
     */
    readonly bestScore?: () => number;
}

/**
 * An entry that brings its own renderers and mounts into an element, which
 * plays on chip `K`, or makes no sound. Without `K`, it is any element entry.
 * An entry makes its `load` with `defineElementLoader`, as a Pixi entry does
 * with `definePixiLoader`.
 */
export type ElementEntryStarter<K extends SoundChoice = SoundChoice> = K extends unknown
    ? ElementEntryStarterFields<K> & SoundChipField<K>
    : never;

/**
 * What every element entry's starter has. It brings its own renderers
 * (three.js, a Pixi application, the DOM, or several at once) and mounts into
 * an element the host gives it. The host still drives its frames, in the MVT
 * order. It calls the session's `update`, then `updateView` and `refreshView`
 * over its `views`, then its `render`.
 */
export interface ElementEntryStarterFields<K extends SoundChoice> {
    readonly kind: 'element';
    /** As for a Pixi entry: how long to advance before taking the thumbnail. */
    readonly thumbnailAdvanceMs?: number;
    /** As for a Pixi entry: the metrics the Arcade's Perfmon can't measure honestly while the entry runs. */
    readonly unmeasuredMetrics?: readonly MetricKind[];
    /** Starts a session, building the entry inside `element`, which it fills. */
    readonly start: (options: ElementStartOptions<K>) => ElementEntrySession;
}

/** How to start an element entry that plays on chip `K`, or makes no sound. */
export type ElementStartOptions<K extends SoundChoice> = ElementStartBase & SoundOption<K>;

/** How to start an element entry, but for its sound. */
export interface ElementStartBase extends StartOptions {
    /** The element to build the entry in. */
    readonly element: HTMLElement;
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
    /** For a game with a highscore table (`hasHighscores`): its score, and when its run ends. */
    readonly scoring?: EntryScoring;
    /**
     * For a game that can be saved part way through, to resume next time.
     * Returns the game as it stands, as a value JSON can hold, for
     * `loadGame` to restore. Returns undefined when there is nothing worth
     * resuming, such as a run that is over. It is called every few seconds
     * of play, and as the visitor leaves, in any phase of the game.
     */
    readonly saveGame?: () => unknown;
    /**
     * Restores a game that `saveGame` returned, maybe on a visit before, in
     * place of the game the session started with. Returns whether it could.
     * A save from an older version of the game may not fit, and then the
     * session plays on as it started.
     */
    readonly loadGame?: (saved: unknown) => boolean;
}

/**
 * What a game tells the Arcade so it can keep the game's highscores. Query
 * bindings, read every frame: the Arcade sees `isOver` turn true, and reads
 * `score` then.
 */
export interface EntryScoring {
    /** The score so far; once the run is over, its final score. */
    readonly score: () => number;
    /** Whether the run has ended, by losing or by winning, until the game starts another. */
    readonly isOver: () => boolean;
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
     * Settles once every renderer can draw. An entry sets it when one of its
     * renderers starts asynchronously, such as Pixi's `Application.init`. A
     * host that produces a single image, such as for a thumbnail or a visual
     * test, waits for it. It is absent when every renderer can draw at once.
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

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns `load`, typed for the chip its starter names. An entry's
 * `start/load.ts` makes its `load` with this, so TypeScript works the chip out
 * from the starter's `soundChip`: the `music` and `sfx` that `start` is given
 * are of that kind, or none for a starter that names no chip. A chip that does not exist
 * is an error, and nothing needs a type written.
 */
export function definePixiLoader<K extends SoundChoice = undefined>(
    load: () => Promise<PixiEntryStarterFields<K> & NamedSoundChip<K>>,
): () => Promise<PixiEntryStarter<K>> {
    // `K` is worked out from `soundChip`, so a starter whose `K` is a chip names it
    return load as () => Promise<PixiEntryStarter<K>>;
}

/** Returns `load`, typed for the chip its starter names, as `definePixiLoader` does. */
export function defineElementLoader<K extends SoundChoice = undefined>(
    load: () => Promise<ElementEntryStarterFields<K> & NamedSoundChip<K>>,
): () => Promise<ElementEntryStarter<K>> {
    return load as () => Promise<ElementEntryStarter<K>>;
}

/**
 * Starts a session of a Pixi entry with `options`. An entry that plays on a
 * chip is also given the music and sound effects chips of its kind, from
 * `findChips`. One that makes no sound is given none.
 */
export function startPixiEntry(starter: PixiEntryStarter, options: PixiStartBase, findChips: SoundChipFinder): EntrySession {
    switch (starter.soundChip) {
        case undefined:
            return starter.start(options);
        case 'audio80':
            return starter.start({ ...options, ...findChips('audio80') });
        case 'audio90':
            return starter.start({ ...options, ...findChips('audio90') });
    }
}

/** Starts a session of an element entry with `options`, and its chips, as `startPixiEntry` does. */
export function startElementEntry(starter: ElementEntryStarter, options: ElementStartBase, findChips: SoundChipFinder): ElementEntrySession {
    switch (starter.soundChip) {
        case undefined:
            return starter.start(options);
        case 'audio80':
            return starter.start({ ...options, ...findChips('audio80') });
        case 'audio90':
            return starter.start({ ...options, ...findChips('audio90') });
    }
}
