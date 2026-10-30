import type { EntryDetails } from '../../../entry-types';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Sudoku Digger's long text, for its info panel and the search. The Arcade loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'Sudoku puzzles being made, one step at a time. First, puzzles are made out of sight, one after another, '
        + 'until one comes out at the level asked for. That one is then made again in sight. Eleven random digits '
        + 'are dropped into an empty grid, and a '
        + 'search fills in the rest, backing up at each dead end. Then cells are dug out of the full grid, one by one. '
        + 'A cell may go only if the puzzle keeps enough givens, and still has just one solution. To check, every '
        + 'other digit that could go there is tried, and the search looks for a solution with it. If it finds one, '
        + 'the cell must stay. The dug puzzle is shuffled, which hides how it was made but keeps it just as hard.',
        'Last, the puzzle is graded, by solving it the way a person would: pencil marks first, then the simplest '
        + 'step of reasoning that gets anywhere, from singles to pairs and triples. The hardest step it needs is its '
        + 'level: Easiest needs only singles, Easy hidden singles, Medium locked candidates, Hard a pair or a '
        + 'triple, and Evil guesswork. Fewer givens alone don\'t make a puzzle hard, so most puzzles come out '
        + 'easier than they were dug for. That is why puzzles are tried out of sight first.',
        'The method follows "Sudoku Puzzles Generating: from Easy to Evil", a paper from the 2008 MCM contest. Its '
        + 'search tries cells in reading order. This one fills the cell with the fewest choices first, so each check '
        + 'takes tens of moves rather than thousands, and you can watch it. The grading by reasoning and the '
        + 'tries out of sight are this demo\'s own, and each level\'s givens and dig order are set so that '
        + 'puzzles of every level turn up often.',
    ].join('\n\n'),
    implementation: [
        'The model runs the whole method one step at a time, as a set of stages: seeding, filling, digging, '
        + 'shuffling and grading. Each step holds the screen for a while, longer for the steps worth reading, and '
        + 'the search\'s moves speed up as a search goes on. Time reaches it only through its update, so Step, '
        + 'Slow, Normal and Fast change only how much time it is given. The search keeps its own stack rather than '
        + 'calling itself, so it can stop after any move, and allocates nothing as it goes. Its random numbers come '
        + 'from a seed, so the same seed makes the same puzzles. That is also how a puzzle tried out of sight is '
        + 'made again in sight: the model notes its random numbers\' state as each try begins, and winds them '
        + 'back to the chosen one\'s.',
        'The views read the model\'s cells, counts and last step. The grid view keeps its flashes as presentation '
        + 'state, set as a count rises, and slides and turns the cells during a shuffle from how far the step has '
        + 'gone. The caption is written only when it changes, and the audio view throttles the search\'s blips, '
        + 'however fast it runs, and plays each digit at its note on a pentatonic scale.',
    ].join('\n\n'),
    howToPlay: {
        intro: 'Watch, or choose a level, a speed, or a new puzzle.',
        controls: [
            { action: 'Choose a level', inputs: [{ button: 'Easiest' }, { button: 'Evil' }], note: 'Starts a new puzzle for that level' },
            { action: 'Step', inputs: [{ button: 'Step' }], note: 'Pauses, and takes one step each press' },
            { action: 'Speed', inputs: [{ button: 'Slow' }, { button: 'Normal' }, { button: 'Fast' }] },
            { action: 'New puzzle', inputs: [{ button: 'New' }] },
        ],
    },
    techniques: [
        'An algorithm run one step at a time, through update',
        'Depth-first search with its own stack',
        'Replaying a random run by winding back its random numbers',
        'Pause, slow and fast motion, and stepping',
        'Presentation state: flashes, slides and a turn',
        'Captions written only when they change',
        'Sounds throttled and pitched by the digit',
    ],
};
