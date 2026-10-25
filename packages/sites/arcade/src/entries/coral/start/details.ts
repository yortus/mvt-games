import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Coral's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: 'A reaction-diffusion system: one chemical feeds the other as both spread across the grid. How fast the food '
        + 'comes and the growth dies decides what grows, and the two drift from one pattern to the next: coral, spots, '
        + 'a maze, holes and worms. The colours change too, slowly, through five schemes of their own. Drag to paint '
        + 'new growth, and double-tap to move on to the next pattern.',
    implementation: 'All the work is in the model, in fixed steps of its own, about twenty-seven a frame. The view only colours '
        + 'each cell by how much growth is there, and uploads the grid as one texture. The colour schemes, the '
        + 'captions and the double tap are the view\'s own presentation state.',
    techniques: [
        'A simulation in fixed steps, many to a frame',
        'A grid uploaded as one texture each frame',
        'Presentation state: colour schemes that fade into each other',
        'Painting and a double tap turned into the model\'s actions',
    ],
};
