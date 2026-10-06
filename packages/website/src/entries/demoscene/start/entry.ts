import type { ArcadeEntry } from '../../../entry-types';
import thumbnail from './thumbnail.webp';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** The demoscene show, as the arcade lists it. Its code loads on launch, from `load.ts`. */
export const entry: ArcadeEntry = {
    id: 'demoscene',
    name: 'MVT Megademo',
    summary: 'A looping show in the style of a 1980s home-computer demo, drawn through a virtual video chip.',
    description: [
        'A looping show in the style of a 1980s C64 demo: raster bars, a bouncing and wobbling logo, '
        + 'a sine scroller in the border, plasma, filled vectors, 48 sprites at once and a credits roll.',
        'Every frame is drawn through a virtual video chip with the memory of an 8-bit home computer, '
        + 'so the limits are real: 16 colours, one colour per character cell, eight sprites to a line. '
        + 'The model is a clock and a script, and the view keeps no state of its own. '
        + 'Add ?crt=off to the address for crisp pixels, or ?debug for raster-time bars.',
    ].join('\n\n'),
    instructions: 'Left and right skip between parts.',
    techniques: [
        'A model that is a pure function of show time: seek, pause and thumbnails for free',
        'A view with no update step and no state: every frame drawn from scratch',
        'A virtual video chip whose memory layout carries the hardware\'s limits',
        'Per-line registers: raster bars, FLD, tech-tech and split screens',
        'A sprite multiplexer: 48 sprites through 8 hardware slots',
        'Pixel-buffer rendering: one texture uploaded per frame',
    ],
    tags: { kind: 'art', era: '1980s', genres: ['demoscene'] },
    // The chip's whole 384 x 272 frame, borders included, at two canvas pixels a chip pixel
    screenWidth: 768,
    screenHeight: 544,
    thumbnail,
    load: async () => (await import('./load')).load(),
};
