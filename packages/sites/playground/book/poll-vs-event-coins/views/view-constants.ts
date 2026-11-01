// Values that several of this example's views share.

/** The styles of a HUD's heading, and of its values. */
export const HEADING_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0x8a9bd0 } as const;
export const VALUE_STYLE = { fontFamily: 'monospace', fontSize: 28, fontWeight: 'bold', fill: 0xe8ecff } as const;

/** How far apart the coins in a HUD are, from middle to middle, in pixels. */
export const COIN_SPACING = 34;
/** How faint a coin is while the player hasn't picked it up yet. */
export const EMPTY_COIN_ALPHA = 0.18;
