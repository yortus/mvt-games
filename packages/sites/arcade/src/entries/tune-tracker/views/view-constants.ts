// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** The Tune Tracker's screen, in its own pixels: the size its entry lists. */
export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 500;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** The bar along the top: the title, play and stop, and where the song is. */
export const TITLE_HEIGHT = 14;

/** The four panels under the title bar, side by side: each one's left edge and width. */
export const PANELS_Y = 16;
export const PANELS_HEIGHT = 136;
export const TUNES_X = 0;
export const TUNES_WIDTH = 172;
export const SONG_X = 174;
export const SONG_WIDTH = 210;
export const ORDER_X = 386;
export const ORDER_WIDTH = 118;
export const INSTRUMENTS_X = 506;
export const INSTRUMENTS_WIDTH = 294;
/** How many lines each panel holds under its heading. */
export const PANEL_LINES = 11;

/** The channels' meters: a number, a scope and a level for each. */
export const METERS_Y = 154;
export const METERS_HEIGHT = 36;

/** The pattern, and how many of its lines show. The line in the middle is the row playing. */
export const PATTERN_Y = 192;
export const PATTERN_HEIGHT = SCREEN_HEIGHT - PATTERN_Y;
export const PATTERN_LINES = 30;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

// The colours of a text-mode screen, the Tune Tracker's own: a deep blue
// behind, slate panels with light and dark edges, and the text in a few
// bright inks.

export const SCREEN_COLOR = 0x0a0e1a;
export const PANEL_COLOR = 0x1d2740;
export const PANEL_LIGHT_COLOR = 0x3d4d78;
export const PANEL_DARK_COLOR = 0x0b0f1c;
/** The sunken well a panel's lines sit in, and the pattern's background. */
export const WELL_COLOR = 0x04060c;
/** The bar behind the row playing, and behind the tune chosen. */
export const BAR_COLOR = 0x26407e;
/** The shade behind each row that starts a beat. */
export const BEAT_SHADE_COLOR = 0x0c1226;

export const HEADING_COLOR = 0x8fb8ff;
export const TEXT_COLOR = 0xd6dcf0;
export const DIM_TEXT_COLOR = 0x7d88a8;
export const BRIGHT_COLOR = 0xffffff;
export const HIGHLIGHT_COLOR = 0xffe08a;
export const MUSIC_COLOR = 0x5ee6b0;

/** The pattern's inks: a note, a release, an instrument's letter, a volume, an effect, a blank's dot and a column's rule. */
export const NOTE_COLOR = 0xeef2ff;
export const RELEASE_COLOR = 0x8a96b8;
export const INSTRUMENT_COLOR = 0x5fd7ff;
export const VOLUME_COLOR = 0x7cf29a;
export const EFFECT_COLOR = 0xffb454;
export const DOT_COLOR = 0x34406a;
export const RULE_COLOR = 0x2c3858;
/** A row's number, a row that starts a beat, and one that starts a bar. */
export const ROW_COLOR = 0x6b7493;
export const BEAT_ROW_COLOR = 0xc0c8e0;
export const BAR_ROW_COLOR = HIGHLIGHT_COLOR;
