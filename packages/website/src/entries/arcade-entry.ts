import type { EntryStarter } from './entry-starter';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Something the site lists and runs: a game, a demo or an art piece. It holds
 * only what the arcade shows without running anything, so listing every entry
 * loads no entry's code. `load` imports the code, and loads its assets.
 */
export interface ArcadeEntry {
    /** Unique, and the name of the entry's directory (`'crumb-chase'`). */
    readonly id: string;
    /** Display name (`'Crumb Chase'`). */
    readonly name: string;
    /** One or two lines: the first thing its info panel says, and a place the search looks. */
    readonly summary: string;
    /** A paragraph or two, for the entry's info panel. */
    readonly description: string;
    readonly tags: EntryTags;
    /**
     * The entry's play area, in its own pixels: the shape of its card and its
     * thumbnail, and the size it plays at, scaled to fit. An entry whose play
     * area follows the viewport gives the size it is designed around.
     */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /** How to play, for the info panel and the pause menu. */
    readonly instructions?: string;
    /** The techniques and patterns the entry shows, for the info panel. */
    readonly techniques?: readonly string[];
    /** The thumbnail image's URL: a picture of the whole play area. */
    readonly thumbnail: string;
    /**
     * The part of the play area the entry's card shows, of whatever shape
     * suits it best: its most telling part. Defaults to the whole play area.
     */
    readonly thumbnailCrop?: ThumbnailCrop;
    /**
     * The colour of the entry's card, from the arcade's candy palette (its
     * title is a deep shade of it): one that suits its thumbnail. Defaults to
     * one picked from its id, the same every time.
     */
    readonly cardColor?: CardColor;
    /** Imports the entry's code, and loads its assets. */
    readonly load: () => Promise<EntryStarter>;
}

/** A rectangle of an entry's play area, in the entry's own pixels. */
export interface ThumbnailCrop {
    /** Its top left corner. */
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** What the arcade filters entries by. Each group's values are listed, in display order, below. */
export interface EntryTags {
    readonly kind: EntryKind;
    /** The era the entry is in the style of. Absent where there is none. */
    readonly era?: Era;
    /** None, one or several: only those that say what the entry is. */
    readonly genres: readonly Genre[];
}

/**
 * A game is played, a demo shows a technique (its info panel explains how),
 * and an art piece is there to be watched (its info panel says what it is).
 */
export type EntryKind = 'game' | 'demo' | 'art';

/** The decade an entry is in the style of. */
export type Era = '1970s' | '1980s' | '1990s' | '2000s' | '2010s';

/** What sort of game, or what a demo is about. */
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
    | 'demoscene';

/** The arcade's candy palette, for cards. */
export type CardColor = 'bubblegum' | 'peach' | 'apricot' | 'lemon' | 'mint' | 'seafoam' | 'sky' | 'lavender' | 'orchid';

/** The renderers an entry draws with, found in its source at build time. */
export type RendererKind = 'pixi' | 'three' | 'html';

/** Every value of each tag, and of the card colours, in the order the arcade lists them. */
export const ENTRY_KINDS: readonly EntryKind[] = ['game', 'demo', 'art'];
export const ERAS: readonly Era[] = ['1970s', '1980s', '1990s', '2000s', '2010s'];
export const GENRES: readonly Genre[] = [
    'shooter', 'maze', 'action', 'fighting', 'scrolling', 'puzzle', 'simulation', '3d', 'ui', 'demoscene',
];
export const RENDERER_KINDS: readonly RendererKind[] = ['pixi', 'three', 'html'];
export const CARD_COLORS: readonly CardColor[] = [
    'bubblegum', 'peach', 'apricot', 'lemon', 'mint', 'seafoam', 'sky', 'lavender', 'orchid',
];

/** The part of `entry`'s play area its card shows: its own crop, or the whole play area. */
export function thumbnailCropOf(entry: ArcadeEntry): ThumbnailCrop {
    return entry.thumbnailCrop ?? { x: 0, y: 0, width: entry.screenWidth, height: entry.screenHeight };
}
