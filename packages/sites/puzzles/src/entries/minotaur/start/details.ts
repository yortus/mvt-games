import type { EntryDetails } from '@mvtjs/site-kit/entry-types';
import { HOW_TO_PLAY } from './how-to-play';

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

/** Minotaur's long text, for its info panel and the search. The page loads it after its first paint, not with the cards. */
export const details: EntryDetails = {
    description: [
        'Minotaur is a logic puzzle in which you build a maze from clues on its walls. Elsewhere, this kind of puzzle is '
        + 'known as Build a Maze or Labyrinth. The maze has one way through. It\'s a single path from S to E that passes '
        + 'through every cell once. Every side of a cell that the path doesn\'t cross is a wall. The numbers along the top '
        + 'and down the left are the clues. Each number is the length of a stretch of wall on that line, in order, as in a '
        + 'paint-by-numbers puzzle.',
        'There is a new maze every day at each of four levels. Easy is a 5 by 5 grid, and Expert is 11 by 11. Everyone gets '
        + 'the same mazes on the same day, and you can still play every day back to the start of 2026. At Hard and Expert, '
        + 'a few lines hide their whole clue behind a ?, so you have less to work from. Each maze you build '
        + 'is ticked off on the calendar. If you leave a maze half done, it\'s kept just as you left it.',
    ].join('\n\n'),
    implementation: [
        'Each maze is made when you open it. The maker starts from a seed, a number worked out from the maze\'s date and '
        + 'level. The same seed always makes the same maze, so every player gets the same puzzle without a request to a '
        + 'server.',
        'The maker first draws a random path through every cell. It starts with a path that snakes along the rows, then '
        + 'reshapes it with many "backbite" moves. Each move joins one end of the path to a cell beside it. That makes a '
        + 'loop, so the move then cuts the loop open again beside that cell. The path still passes through every cell '
        + 'once, but its shape has changed. Every side that the finished path doesn\'t cross becomes a wall, and the maker '
        + 'reads the clues off those walls.',
        'Next, a solver checks that you can build the maze from its clues without guessing. It uses three rules, and each '
        + 'rule reads only the board as it stands. The first rule works on one line at a time, as you would in a nonogram, '
        + 'a paint-by-numbers puzzle. If a side is a wall in every way that the line\'s clue can fit, it must be a wall. '
        + 'The same goes for a gap. The second rule looks at each cell. The path enters and leaves every cell, so it '
        + 'crosses two of the cell\'s sides. At S and E, it crosses only one. Once a cell has all the crossings it needs, '
        + 'its other sides must be walls. The third rule walls off any side that would close a loop.',
        'If the rules settle every side, the maze has one solution, and the maker keeps it. If they get stuck, the maker '
        + 'draws another path. That happens to about one path in ten on the small grids, and one in four at Expert. The '
        + 'solver was checked against every possible path on grids up to 5 by 5, which are small enough for a search to '
        + 'list every path.',
        'At Hard and Expert, the maker then hides some clues. It visits the lines in a random order, and hides a line\'s '
        + 'clue if the rules can still finish the maze without it. So every hidden clue is one you can do without, and '
        + 'you never have to guess. Hard hides three clues, and Expert hides four.',
        'When you drag through cells, the board view turns your pointer\'s movement into steps between cells, which draw '
        + 'the path. When you drag along lines, it turns the movement into steps between the grid\'s corners, which draw '
        + 'walls. The puzzle model stores each stroke as one action, so Undo takes back a whole stroke.',
    ].join('\n\n'),
    howToPlay: {
        intro: HOW_TO_PLAY.rules.join(' '),
        controls: [
            { action: 'Choose a day', inputs: ['click', 'tap'], note: 'Pick a level from the tabs first' },
            ...HOW_TO_PLAY.controls,
            { action: 'How to play', inputs: [{ button: 'How to play' }], note: 'Shows the rules again, and Show me walks you through drawing' },
        ],
        notes: HOW_TO_PLAY.notes,
    },
};
