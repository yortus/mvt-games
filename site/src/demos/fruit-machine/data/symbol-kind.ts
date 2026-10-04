// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The symbols on the reels: six pictures, `pic1` paying most, and the wild,
 * which stands in for any picture. The model knows only these names; what
 * each one looks like (the fruit) is up to the views.
 */
export type SymbolKind = PictureKind | 'wild';

/** The symbols that pay: every symbol but the wild. */
export type PictureKind = 'pic1' | 'pic2' | 'pic3' | 'pic4' | 'pic5' | 'pic6';

/** Every picture, highest paying first. */
export const PICTURE_KINDS: readonly PictureKind[] = ['pic1', 'pic2', 'pic3', 'pic4', 'pic5', 'pic6'];
