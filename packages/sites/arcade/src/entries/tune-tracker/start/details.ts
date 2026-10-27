import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** The Tune Tracker's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'In the 1990s, many musicians wrote their tunes in a tracker. A tracker is a program that shows a song '
        + 'as rows of notes, with one column for each part of the music, called a channel. As the song plays, the '
        + 'rows scroll up past a bar, so you can see the row you\'re hearing.',
        'This demo plays fifteen tunes on the Audio90, this project\'s second sound chip, and shows them the way a '
        + 'tracker would. The Audio90 has sixteen voices, and each one can play FM tones, analog synthesiser '
        + 'tones or samples. A sample is a short sound that the chip can play back at any pitch. The chip\'s songs '
        + 'are written as text in a tracker\'s rows and columns, so you see each tune much as its composer would '
        + 'have.',
        'For each channel, you see the note, the instrument, the volume and any effects, row by row. A meter '
        + 'above each channel shows the sound that voice is making right now. The panels around the pattern show '
        + 'the order the patterns play in, the song\'s settings and its instruments.',
        'Each tune is a study of one of the decade\'s styles. There\'s house, trance, acid, jungle, trip-hop, big '
        + 'beat, ambient house and a ballad. There are also tunes in the style of a 16-bit shooter, a role-playing '
        + 'game, a fighting game, a platformer, a racing game\'s Eurobeat, a PC sound card and an Amiga module.',
    ].join('\n\n'),
    implementation: [
        'None of the sounds is recorded. As the demo loads, the chip makes its samples by playing short tunes on '
        + 'its own engines and keeping what they sound like.',
        'What you see is exactly what the chip plays. Each tune is read once into numbers, and the chip plays '
        + 'those numbers. The view writes each one back out as tracker text, and that text reads back as the same '
        + 'numbers, so the two can\'t drift apart. The chip reports which row is playing, so the pattern '
        + 'moves in time with the music, and stops when you pause.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Choose a tune and press Play.',
        controls: [
            { action: 'Choose a tune', inputs: ['up-down', 'left-right'] },
            { action: 'Play or stop', inputs: ['space'] },
            { action: 'Play a tune', inputs: ['click', 'tap'] },
        ],
    },
    techniques: [
        'Each cell of a song written back as tracker text, which reads back as the same cell',
        'The chip reporting which row is playing, so the pattern view can follow it',
        'Every tune laid out once as character codes, so the pattern scrolls without creating objects each frame',
        'The site\'s shared pixel glyphs, drawn into a texture by a script',
        'Meters drawn from what the chip\'s audio thread reports about each voice',
    ],
};
