import type { SymbolKind } from '../../data';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

// Flat and bright, with no gradients: each fruit is drawn in at most three
// tones, and one leaf green is shared by every fruit that has a leaf. The wild
// is the exception: its rainbow background is every fruit's colour at once.

/** The one green of every leaf and stem. */
const LEAF_GREEN = '#3fae5a';

/** The tones each symbol is drawn in, by what they colour. */
export const SYMBOL_TONES = {
    pic1: { rind: '#2db55d', flesh: '#ff5468', seed: '#3a2440' },
    pic2: { grape: '#a35df0', shade: '#6b2fc0', leaf: LEAF_GREEN },
    pic3: { cherry: '#f23a50', shade: '#b3162d', stem: LEAF_GREEN },
    pic4: { peel: '#ff8a1f', highlight: '#ffc47f', leaf: LEAF_GREEN },
    pic5: { peel: '#ffd63a', highlight: '#fff1a6', tip: '#e9b300' },
    pic6: { berry: '#3d7bff', crown: '#1c3d9c', highlight: '#aac9ff' },
    wild: { letter: '#ffffff', outline: '#2a1640' },
} as const;

/** The one colour that says each symbol: for juice, glows and win lines. The wild's is the white of its lettering. */
export const SYMBOL_COLORS: { readonly [K in SymbolKind]: string } = {
    pic1: SYMBOL_TONES.pic1.flesh,
    pic2: SYMBOL_TONES.pic2.grape,
    pic3: SYMBOL_TONES.pic3.cherry,
    pic4: SYMBOL_TONES.pic4.peel,
    pic5: SYMBOL_TONES.pic5.peel,
    pic6: SYMBOL_TONES.pic6.berry,
    wild: SYMBOL_TONES.wild.letter,
};
