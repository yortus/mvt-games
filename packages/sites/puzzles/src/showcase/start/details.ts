import type { EntryDetails } from '@mvtjs/site-kit/entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The Daily Fold's long text, for its info panel, which the nav's (i) opens while the paper shows. The site's page loads it as the panel opens. */
export const details: EntryDetails = {
    description: 'A newspaper lying on a desk, with one of the site\'s puzzles printed on each spread inside. Turn its '
        + 'pages, lean in to a puzzle, and play it over the paper. A new edition comes out every day, laid out afresh, '
        + 'with the day\'s puzzles in a new order.',
    howToPlay: {
        intro: 'Turn the pages to find a puzzle, then play it.',
        controls: [
            { action: 'Turn the page', inputs: [{ control: 'left-right' }, 'click'], touchInputs: ['swipe', 'tap'] },
            { action: 'Play the puzzle on the spread', inputs: [{ control: 'primary' }, 'click'], touchInputs: ['tap'] },
        ],
        notes: [
            'The puzzle plays as it does from its own card. Leave it, as you would any puzzle, to lean back to the paper.',
            'The front page lists the puzzles inside, and the page each is on.',
            'The headlines you can read are real ones, from Wikinews (en.wikinews.org), licensed CC BY 2.5.',
        ],
    },
    implementation: 'The paper is a PixiJS 3D scene. Each page is printed on a canvas as it\'s needed: columns of grey '
        + 'lines, made-up photos and a few real headlines a reader can read, all laid out from the day\'s number, so the paper is '
        + 'the same all day for everyone. A turning page is a mesh of thin strips, bent round the spine each frame, its '
        + 'outer edge leading. Leaning in glides the camera until the puzzle\'s box lands exactly where the site\'s page '
        + 'will play the puzzle, which then launches over the paper.',
    techniques: [
        'Puzzles inside a newspaper',
        'Pages printed on canvas textures',
        'A mesh bent in place each frame',
        'A camera framing a box exactly where an entry will play',
    ],
};
