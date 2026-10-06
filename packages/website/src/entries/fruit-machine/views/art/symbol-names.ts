import type { SymbolKind } from '../../data';

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** What each symbol is called, in the fruit theme. The model only knows `pic1` to `pic6` and `wild`. */
export const SYMBOL_NAMES: { readonly [K in SymbolKind]: string } = {
    pic1: 'Watermelon',
    pic2: 'Grapes',
    pic3: 'Cherries',
    pic4: 'Orange',
    pic5: 'Lemon',
    pic6: 'Blueberries',
    wild: 'Wild',
};

/** Each symbol as six characters of text, for the terminal's reels. */
export const SYMBOL_LABELS: { readonly [K in SymbolKind]: string } = {
    pic1: 'MELON ',
    pic2: 'GRAPES',
    pic3: 'CHERRY',
    pic4: 'ORANGE',
    pic5: 'LEMON ',
    pic6: 'BERRY ',
    wild: '*WILD*',
};
