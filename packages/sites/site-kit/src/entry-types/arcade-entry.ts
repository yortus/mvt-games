import type { ArcadeControl } from '../input';
import type { EntryStarter } from './entry-starter';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Something the site lists and runs: a game or a demo. It holds only what
 * the arcade's cards show, so listing every entry loads no entry's code, and
 * none of its long text. `loadDetails` imports the long text, and `load`
 * imports the code and loads its assets.
 */
export interface ArcadeEntry {
    /** Unique, and the name of the entry's directory (`'crumb-chase'`). */
    readonly id: string;
    /** Display name (`'Crumb Chase'`). */
    readonly name: string;
    /** One or two lines: the first thing its info panel says, and a place the search looks. */
    readonly summary: string;
    /** What the search filters it by: the era it is in the style of, if one, then its genres. */
    readonly tags: readonly EntryTag[];
    /**
     * The entry's play area, in its own pixels: the shape of its card and its
     * thumbnail, and the size it plays at, scaled to fit. An entry whose play
     * area follows the viewport gives the size it is designed around.
     */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /**
     * The classic the entry is inspired by, if it is one game rather than a
     * genre: credited in the info panel, and a place the search looks. The
     * one place another game's title may appear.
     */
    readonly inspiredBy?: Inspiration;
    /** The thumbnail image's URL: a picture of the whole play area. */
    readonly thumbnail: string;
    /**
     * The part of the play area the entry's card shows, of whatever shape
     * suits it best: its most telling part. Defaults to the whole play area.
     */
    readonly thumbnailCrop?: ThumbnailCrop;
    /**
     * The point of the play area a card cropped closer than `thumbnailCrop`
     * keeps at its centre, as nearly as the crop allows: what the picture is
     * of. A theme whose cards show a square photo crops a wide or tall
     * picture so, keeping this point in view. Every entry in a catalogue
     * gives one; it defaults to the crop's centre.
     */
    readonly thumbnailFocus?: ThumbnailFocus;
    /**
     * The colour of the entry's card, from the arcade's candy palette (its
     * title is a deep shade of it): one that suits its thumbnail. Defaults to
     * one picked from its id, the same every time.
     */
    readonly cardColor?: CardColor;
    /**
     * Whether the entry keeps a highscore table: a game whose sessions report
     * their `scoring`, and whose id is in the highscores Worker's games.
     */
    readonly hasHighscores?: boolean;
    /**
     * Something the visitor should know before they play, such as that a
     * demo that looks like gambling is not. It opens over the entry each time
     * it starts, until the visitor asks not to see it again. It also heads
     * the Description in the entry's info panel. Most entries need none.
     */
    readonly notice?: EntryNotice;
    /**
     * Imports the entry's long text, from its `start/details.ts`. The arcade
     * loads every entry's after its first paint, so the home page's first load
     * holds only what the cards show.
     */
    readonly loadDetails: () => Promise<EntryDetails>;
    /** Imports the entry's code, and loads its assets. */
    readonly load: () => Promise<EntryStarter>;
}

/** An entry's long text: what its info panel tells beyond its card, and what the search reads beyond its summary. */
export interface EntryDetails {
    /** What the entry is, for a player: a paragraph or two, for the entry's info panel. Paragraphs are separated by a blank line. */
    readonly description: string;
    /**
     * How the entry is built, for a developer: a paragraph or two, which the
     * info panel shows under How It's Made, after the description.
     * Paragraphs are separated by a blank line.
     */
    readonly implementation?: string;
    /** How to play, for the info panel's How to Play tab, which the runner's (i) opens over the game. */
    readonly howToPlay?: HowToPlay;
    /** The techniques and patterns the entry shows, for the info panel, under How It's Made. */
    readonly techniques?: readonly string[];
}

/**
 * How to play an entry. It says what to do, what the controls are, and
 * anything else worth knowing. Give at least one of the three. The info
 * panel shows the controls as a table, with one action to a row. It has a
 * column for the keyboard and one for the mouse or touch. So the controls
 * are data rather than text. The panel shows only the controls of the
 * device it is on. A desktop shows the keyboard and the mouse, and a phone
 * or tablet shows touch. A laptop with a touch screen shows all of them.
 */
export interface HowToPlay {
    /** What to aim for, or what to do, in a sentence or two. */
    readonly intro?: string;
    /** The controls, one row for each thing the player does. */
    readonly controls?: readonly ControlRow[];
    /** Anything else worth knowing, a short paragraph each. */
    readonly notes?: readonly string[];
}

/**
 * One thing the player does, and the inputs that do it. Any one of the
 * inputs does it. A row shows only where the device has some way to do it,
 * or a note about it.
 */
export interface ControlRow {
    /** What it does, in a word or two, such as `'Move'` or `'Shoot'`. */
    readonly action: string;
    /**
     * The inputs that do it on any device that has them. The arcade controls
     * and keys show in the keyboard's column. Gestures and buttons that work
     * with a mouse or a finger show in the next column, such as an entry's
     * own buttons. A click and the wheel show only where there is a mouse.
     */
    readonly inputs?: readonly ControlInput[];
    /**
     * The inputs that do it on a touch screen only. These are the touch
     * controls the host draws, such as its joystick and buttons. They are
     * also the gestures a game handles only on a touch screen, such as a
     * swipe over its view.
     */
    readonly touchInputs?: readonly ControlInput[];
    /** More about it, shown under the action, such as `'Hold to rise, let go to sink'`. */
    readonly note?: string;
    /** More about it on a touch screen, shown under the action there only. */
    readonly touchNote?: string;
}

/**
 * An input. It can be one of the arcade controls, such as
 * `{ control: 'primary' }`. It can be a key, or a set of keys used as one,
 * such as `'arrows'`. Inputs pressed together are a list, such as
 * `[{ control: 'primary' }, 'forward']`. On a touch screen, the list can
 * hold a button, with the joystick's direction as a key:
 * `[{ button: 'Atk' }, 'up']`. For touch and the mouse, an input can also
 * be a gesture, or a button on the screen, such as `{ button: 'Fire' }`.
 */
export type ControlInput =
    | ArcadeControlInput | ControlKey | readonly (ArcadeControlInput | ControlKey | ControlButton)[] | ControlGesture | ControlButton;

/**
 * One of the arcade controls. It can also be a set of the d-pad's
 * directions that the player uses as one: left and right, up and down, or
 * all four. It shows as the keys that the arcade controls' table has for
 * it. So the keys shown are the keys that work. A control with two keys,
 * such as Left and A, shows as two sets of keys, and either one does the
 * action. In a list of inputs pressed together, it shows as its first key.
 * An entry that uses the arcade controls names them this way, not by their
 * keys.
 */
export interface ArcadeControlInput {
    readonly control: ArcadeControl | 'left-right' | 'up-down' | 'dpad';
}

/**
 * A key, or a set of keys that the player uses as one, such as all four
 * arrows. An entry that listens to the keyboard itself names its keys this
 * way. Forward and back are the directions toward the opponent and away
 * from them. A fighting game's moves use them, since the moves depend on
 * which way a fighter faces.
 */
export type ControlKey = 'arrows' | 'wasd' | 'up' | 'down' | 'forward' | 'back' | 'space';

/**
 * A gesture, on a touch screen or with a mouse. The joystick is the one a game
 * draws on a touch screen. A hold is a finger kept down, anywhere.
 */
export type ControlGesture = 'joystick' | 'swipe' | 'tap' | 'double-tap' | 'hold' | 'drag' | 'pinch' | 'click' | 'wheel';

/** A button on the screen, by its label. An entry can draw it, or it can be one of the host's touch controls. */
export interface ControlButton {
    readonly button: string;
}

/**
 * What an entry's visitor should know before they play: a heading, and a
 * paragraph or two. The text is plain, with paragraphs separated by a blank
 * line, as in `EntryDetails`.
 */
export interface EntryNotice {
    /** The heading, in a few words. */
    readonly title: string;
    /** What the visitor should know. Keep it short enough to read before playing. */
    readonly text: string;
}

/** A game an entry is inspired by: its title, who made it, and the year it came out. */
export interface Inspiration {
    /** Its title, as it was released (`'Pac-Man'`). */
    readonly title: string;
    /** The company that made or released it (`'Namco'`). */
    readonly maker: string;
    /** The year of its first release, on whatever machine that was. */
    readonly year: number;
}

/** A point of an entry's play area, in the entry's own pixels. */
export interface ThumbnailFocus {
    readonly x: number;
    readonly y: number;
}

/** A rectangle of an entry's play area, in the entry's own pixels. */
export interface ThumbnailCrop {
    /** Its top left corner. */
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * A tag the search filters entries by: an era, or a genre. An entry has at
 * most one era, and only the genres that say what it is. No tag rules out
 * another: the search shows the entries with every tag chosen. Each kind's
 * values are listed, in display order, below.
 */
export type EntryTag = Era | Genre;

/**
 * What a site's entries are, which the site says (`SiteConfig`), not each
 * entry. A game is played. A demo is there to be watched or explored: it
 * shows a technique (its info panel explains how), or it is a piece of art
 * (its tags include `'art'`, and its info panel says what it is).
 */
export type EntryKind = 'game' | 'demo';

/** The decade an entry is in the style of. */
export type Era = '1970s' | '1980s' | '1990s' | '2000s' | '2010s';

/**
 * What sort of game, or what a demo is about. `'art'` marks a demo made to be
 * looked at, more than to show a technique. `'tiny'` marks an entry kept as
 * small as it can be, about a model and a view, as a first one to read.
 */
export type Genre =
    | 'shooter'
    | 'maze'
    | 'action'
    | 'fighting'
    | 'scrolling'
    | 'puzzle'
    | 'simulation'
    | '3d'
    | 'ui'
    | 'demoscene'
    | 'art'
    | 'tiny'
    | 'sound';

/** The arcade's candy palette, for cards. */
export type CardColor = 'bubblegum' | 'peach' | 'apricot' | 'lemon' | 'mint' | 'seafoam' | 'sky' | 'lavender' | 'orchid';

/** The renderers an entry draws with, found in its source at build time. */
export type RendererKind = 'pixi' | 'three' | 'html';

/** Every value of each tag, and of the card colours, in the order the arcade lists them. */
export const ENTRY_KINDS: readonly EntryKind[] = ['game', 'demo'];
export const ERAS: readonly Era[] = ['1970s', '1980s', '1990s', '2000s', '2010s'];
export const GENRES: readonly Genre[] = [
    'shooter', 'maze', 'action', 'fighting', 'scrolling', 'puzzle', 'simulation', '3d', 'ui', 'demoscene', 'art', 'tiny', 'sound',
];
export const RENDERER_KINDS: readonly RendererKind[] = ['pixi', 'three', 'html'];
export const CARD_COLORS: readonly CardColor[] = [
    'bubblegum', 'peach', 'apricot', 'lemon', 'mint', 'seafoam', 'sky', 'lavender', 'orchid',
];

/** The part of `entry`'s play area its card shows: its own crop, or the whole play area. */
export function thumbnailCropOf(entry: ArcadeEntry): ThumbnailCrop {
    return entry.thumbnailCrop ?? { x: 0, y: 0, width: entry.screenWidth, height: entry.screenHeight };
}

/** The point a closer crop of `entry`'s picture keeps at its centre: its own, or its crop's centre. */
export function thumbnailFocusOf(entry: ArcadeEntry): ThumbnailFocus {
    if (entry.thumbnailFocus !== undefined) return entry.thumbnailFocus;
    const crop = thumbnailCropOf(entry);
    return { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
}
