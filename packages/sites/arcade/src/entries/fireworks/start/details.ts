import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The harbour fireworks' long text, for their info panel, the pause menu and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'A fireworks show that never ends. Each rocket bursts at the top of its climb, and its sparks spread, '
        + 'slow, fall and fade, behind the city and again, dimmer and upside down, in the water.',
        'The model is the rockets and a fixed pool of sparks, moved in sky units only in its update. The view '
        + 'shows the same pool twice: once in the sky, and once flipped about the water line as the reflection.',
    ].join('\n\n'),
};
