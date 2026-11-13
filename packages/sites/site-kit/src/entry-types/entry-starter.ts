import type { Container } from 'pixi.js';
import type { MetricKind, View } from '@mvtjs/pixi';
import type { Audio80, Audio90 } from 'audio90';
import type { DpadKind } from '#input/pixi';
import type { ArcadeControls } from '../input';
import type { MusicChip, SfxChip } from '../sound';

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

/** How a starter uses the arcade controls, or undefined for a starter that doesn't use them. */
export type ControlsChoice = ArcadeControlsUse | undefined;

/**
 * What a starter declares about the arcade controls. A starter that uses
 * them declares how, and one that doesn't declares nothing.
 */
export type ControlsField<C extends ControlsChoice> = C extends ArcadeControlsUse ? UsesArcadeControls<C> : UsesNoArcadeControls;

/** A starter that uses the arcade controls as `C` says. */
export interface UsesArcadeControls<C extends ArcadeControlsUse> {
    /**
     * Requests the arcade controls, and says how the host draws them on a
     * touch screen. It is a layout, or `'keys-only'`. An entry whose own view
     * handles touch uses `'keys-only'`, and the host then draws no touch
     * controls. The host passes the session its controls as `controls`. It
     * handles their keys while the entry plays.
     */
    readonly arcadeControls: C;
    /**
     * Plays the arcade controls while the entry's thumbnail is set up, for a
     * picture of it in action. It is called before each step of the advance.
     * It receives the session's arcade controls and the time advanced so far.
     * It sets what is held from the `'script'` source.
     */
    readonly thumbnailInput?: (controls: ArcadeControls, elapsedMs: number) => void;
}

/**
 * A starter's `arcadeControls`, as `definePixiLoader` reads it to work out
 * `C`. That is how the starter uses the arcade controls, or not at all.
 */
export interface NamedArcadeControls<C extends ControlsChoice> {
    readonly arcadeControls?: C;
    /** As `UsesArcadeControls` says. Only a starter that uses the arcade controls can have it. */
    readonly thumbnailInput?: C extends ArcadeControlsUse ? (controls: ArcadeControls, elapsedMs: number) => void : undefined;
}

/** A starter that doesn't use the arcade controls. */
export interface UsesNoArcadeControls {
    /** Absent, since the entry doesn't use the arcade controls. Its sessions aren't passed any. */
    readonly arcadeControls?: undefined;
    /** Absent, since the entry doesn't use the arcade controls. */
    readonly thumbnailInput?: undefined;
}

/** The `controls` start option that goes with a starter's use of the arcade controls. A starter that doesn't use them is passed none. */
export type ControlsOption<C extends ControlsChoice> = C extends ArcadeControlsUse ? WithArcadeControls : WithoutArcadeControls;

/** The start options of a session that uses the arcade controls. */
export interface WithArcadeControls {
    /**
     * The session's arcade controls. A game's top-level view listens to them
     * with `ArcadeControlsInputView`. In the page, the host sets what is held
     * from the keys and the touch controls. Started headless, they are held
     * only from `thumbnailInput`, or from a test's own script.
     */
    readonly controls: ArcadeControls;
}

/** The start options of a session that doesn't use the arcade controls. */
export interface WithoutArcadeControls {
    /** Absent, since the entry doesn't use the arcade controls. */
    readonly controls?: undefined;
}

/**
 * The arcade controls that a host has created for a session. The host passes
 * them to `startPixiEntry` or `startElementEntry`, which pass them on only to
 * an entry that uses them.
 */
export interface ControlsFromHost {
    readonly controls?: ArcadeControls;
}

/**
 * An entry drawn with Pixi on the host's stage, which plays on chips of kind
 * `K`, or makes no sound, and uses the arcade controls as `C` says, or not at
 * all. Without `K` and `C`, it is any Pixi entry, and TypeScript
 * distinguishes them by `soundChip` and `arcadeControls`. An entry makes its `load` with
 * `definePixiLoader`, which works out `K` from the `soundChip` its starter
 * names, so that the `music` and `sfx` its sessions are passed are of that
 * kind, and `C` from its `arcadeControls`, so that its sessions are passed
 * `controls` only if it uses them.
 */
export type PixiEntryStarter<K extends SoundChoice = SoundChoice, C extends ControlsChoice = ControlsChoice> = K extends unknown
    ? C extends unknown
        ? PixiEntryStarterFields<K, C> & SoundChipField<K> & ControlsField<C>
        : never
    : never;

/**
 * What every Pixi entry's starter has. The host owns the Pixi application,
 * scales the play area to fit, draws touch controls around it, and pauses the
 * entry by leaving its container out of `updateView`. It can also start the
 * entry headless, on a bare container, as thumbnails and benchmarks do.
 */
export interface PixiEntryStarterFields<K extends SoundChoice, C extends ControlsChoice> {
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
     * The colour the host fills the canvas with before the entry draws, as
     * a number such as `0xf3eee3`. It shows around the play area, where the
     * play area's shape doesn't match the screen's, so an entry with a light
     * background of its own names it here. Black by default.
     */
    readonly backgroundColor?: number;
    /**
     * How long to advance the entry before taking its thumbnail. Defaults to
     * one frame. An entry that takes a while to assemble asks for more.
     */
    readonly thumbnailAdvanceMs?: number;
    /**
     * The metrics the Arcade's Perfmon can't measure honestly while the entry
     * runs, which it shows as n/a. For example, `reads`, for an entry whose
     * views draw by hand and don't count their reads (`addReads`). None by
     * default.
     */
    readonly unmeasuredMetrics?: readonly MetricKind[];
    /** Starts a session, adding the entry's view to `stage`. */
    readonly start: (options: PixiStartOptions<K, C>) => EntrySession;
}

/** How to start a Pixi entry that plays on chip `K`, or makes no sound, and uses the arcade controls as `C` says, or not at all. */
export type PixiStartOptions<K extends SoundChoice, C extends ControlsChoice = undefined> = PixiStartBase & SoundOption<K> & ControlsOption<C>;

/** How to start a Pixi entry, but for its sound and its arcade controls. */
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
export type ElementEntryStarter<K extends SoundChoice = SoundChoice, C extends ControlsChoice = ControlsChoice> = K extends unknown
    ? C extends unknown
        ? ElementEntryStarterFields<K, C> & SoundChipField<K> & ControlsField<C>
        : never
    : never;

/**
 * What every element entry's starter has. It brings its own renderers
 * (three.js, a Pixi application, the DOM, or several at once) and mounts into
 * an element the host gives it. The host still drives its frames, in the MVT
 * order. It calls the session's `update`, then `updateView` and `refreshView`
 * over its `views`, then its `render`.
 */
export interface ElementEntryStarterFields<K extends SoundChoice, C extends ControlsChoice> {
    readonly kind: 'element';
    /** As for a Pixi entry: how long to advance before taking the thumbnail. */
    readonly thumbnailAdvanceMs?: number;
    /** As for a Pixi entry: the metrics the Arcade's Perfmon can't measure honestly while the entry runs. */
    readonly unmeasuredMetrics?: readonly MetricKind[];
    /** Starts a session, building the entry inside `element`, which it fills. */
    readonly start: (options: ElementStartOptions<K, C>) => ElementEntrySession;
}

/** How to start an element entry, as a Pixi entry's `PixiStartOptions` says. */
export type ElementStartOptions<K extends SoundChoice, C extends ControlsChoice = undefined> = ElementStartBase & SoundOption<K> & ControlsOption<C>;

/** How to start an element entry, but for its sound and its arcade controls. */
export interface ElementStartBase extends StartOptions {
    /** The element to build the entry in. */
    readonly element: HTMLElement;
    /**
     * Whether the visitor is playing the entry, so that it should take their
     * input. An entry that listens to the keyboard itself, rather than
     * through the arcade controls, listens only while this is true. It is
     * false where the entry plays only to be watched, live on its card. It
     * is absent when the entry is started headless.
     */
    readonly takesInput?: boolean;
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
    /**
     * The question the visitor confirms before the pause menu's Restart
     * takes effect, for an entry where restarting loses something worth keeping,
     * such as "Clear this puzzle and start it again?". Returns undefined
     * when nothing would be lost, and Restart takes effect at once, as it
     * does for an entry without it.
     */
    readonly restartQuestion?: () => string | undefined;
    /**
     * Starts the entry again in place, for an entry that keeps its own
     * progress, such as a puzzle that saves every move. A new session of it
     * would carry on where this one was, so the host calls this instead.
     * Without it, a restart ends the session and starts a new one.
     */
    readonly restart?: () => void;
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

/**
 * How an entry uses the arcade controls. A layout says how the touch
 * controls are laid out. With `'keys-only'`, the entry uses the keys only,
 * and no touch controls are drawn.
 */
export type ArcadeControlsUse = ArcadeControlsLayout | 'keys-only';

/** How the host draws the arcade controls on a touch screen. Every part is left out by default. */
export interface ArcadeControlsLayout {
    /**
     * Whether a touch screen shows a d-pad. It is off by default. A game
     * that steers by swiping or dragging over its own view shows none.
     */
    readonly showDpad?: boolean;
    /** Which directions the d-pad goes. It goes all four by default. A game that needs only left and right can choose those. */
    readonly dpadKind?: DpadKind;
    readonly showPrimary?: boolean;
    readonly showSecondary?: boolean;
    readonly primaryLabel?: string;
    readonly secondaryLabel?: string;
    readonly floatingJoystick?: boolean;
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
export function definePixiLoader<K extends SoundChoice = undefined, C extends ControlsChoice = undefined>(
    load: () => Promise<PixiEntryStarterFields<K, C> & NamedSoundChip<K> & NamedArcadeControls<C>>,
): () => Promise<PixiEntryStarter<K, C>> {
    // `K` is worked out from `soundChip`, and `C` from `arcadeControls`, so a starter whose `K` is a chip names it,
    // and one whose `C` is a use of the controls declares it
    return load as () => Promise<PixiEntryStarter<K, C>>;
}

/** Returns `load`, typed for the chip its starter names and its use of the arcade controls, as `definePixiLoader` does. */
export function defineElementLoader<K extends SoundChoice = undefined, C extends ControlsChoice = undefined>(
    load: () => Promise<ElementEntryStarterFields<K, C> & NamedSoundChip<K> & NamedArcadeControls<C>>,
): () => Promise<ElementEntryStarter<K, C>> {
    return load as () => Promise<ElementEntryStarter<K, C>>;
}

/**
 * Starts a session of a Pixi entry with `options`. An entry that plays on a
 * chip is also passed the music and sound effects chips of its kind, from
 * `findChips`. One that makes no sound is passed none. An entry that uses
 * the arcade controls is passed `options.controls`, and one that doesn't
 * isn't passed any.
 */
export function startPixiEntry(starter: PixiEntryStarter, options: PixiStartBase & ControlsFromHost, findChips: SoundChipFinder): EntrySession {
    const { controls, ...base } = options;
    const chips = starter.soundChip === undefined ? {} : findChips(starter.soundChip);
    // TypeScript can't follow a starter's chip and its use of the controls into the options its `start` accepts,
    // which `definePixiLoader` worked out from them. The chips and the controls passed here are the ones it named
    const start = starter.start as (options: PixiStartBase & Partial<SessionChips<SoundChipKind>> & ControlsFromHost) => EntrySession;
    return start({ ...base, ...chips, ...pickControls(starter.arcadeControls, controls) });
}

/** Starts a session of an element entry with `options`, and its chips and controls, as `startPixiEntry` does. */
export function startElementEntry(
    starter: ElementEntryStarter,
    options: ElementStartBase & ControlsFromHost,
    findChips: SoundChipFinder,
): ElementEntrySession {
    const { controls, ...base } = options;
    const chips = starter.soundChip === undefined ? {} : findChips(starter.soundChip);
    // As for a Pixi entry, TypeScript can't follow the chip and the controls into the options
    const start = starter.start as (options: ElementStartBase & Partial<SessionChips<SoundChipKind>> & ControlsFromHost) => ElementEntrySession;
    return start({ ...base, ...chips, ...pickControls(starter.arcadeControls, controls) });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The `controls` option for an entry that uses the arcade controls, and none for one that doesn't. */
function pickControls(use: ControlsChoice, controls: ArcadeControls | undefined): ControlsFromHost {
    if (use === undefined) return {};
    if (controls === undefined) throw new Error('entry types: an entry that uses the arcade controls must be passed them');
    return { controls };
}
