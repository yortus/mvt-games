import type { Container } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { PAPER_COLOR } from '../../../../shared';
import type { GameModel } from '../../models';
import { BoardView } from '../board-view';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../view-constants';
import {
    dragTrimmedPiece, lockOneMore, type Play, playSome, poseGame, solve, swapOneHome, swapTrimmedHome, TODAY,
} from './rosette-poses.test-support';

// The picture alone, at the board's own size, on the paper's colour. The game view's tests show the screen round it.
const SIZE = { pixelArt: false, background: PAPER_COLOR };
/** Long enough for a mended window's celebration to end, at under 4 s. */
const CELEBRATED_MS = 5000;

// The easiest and hardest levels, freshly jumbled and then whole, to see how their pieces and colours look at their
// biggest and smallest
for (const level of ['easy', 'expert'] as const) {
    canvasTest(`${withArticle(level)} window, jumbled`, SIZE, () => pose((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
    }));
    canvasTest(`${withArticle(level)} window, whole`, SIZE, () => pose((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY - 1);
    }, solve, CELEBRATED_MS));
}
// Two pieces swapping, partway across, each turning to fit the other's tile. A flight takes 420 ms
canvasTest('two pieces swapping, partway across', SIZE, () => pose(openToday, swapOneHome, 180));
// A piece put in its place next to a lock, lifting and shaking as the frame grows round it, once the 420 ms flight has landed
canvasTest('a piece joining the locked pieces, lifting as the frame grows round it', SIZE, () => pose(openToday, lockOneMore, 560));
// As a window is mended: its ripple partway out from the piece swapped last, once the last two pieces have landed (a
// flight takes 420 ms), then the sun coming up behind it, as it steps back, its light starting to fall on the floor
canvasTest('a window just mended, its ripple spreading', SIZE, () => pose(playSome, solve, 750));
canvasTest('a window mended, the sun coming up behind it', SIZE, () => pose(playSome, solve, 2900));
// A piece the frame trims, picked up and dragged in, showing whole, once it has grown (in 120 ms)
canvasTest('a piece trimmed by the frame, lifted out whole', SIZE, () => pose(openToday, dragTrimmedPiece, 200));
// A piece flying out of a tile the frame trims, sliding out from behind the frame, partway through its 420 ms flight
canvasTest('a piece flying out from behind the frame', SIZE, () => pose(openToday, swapTrimmedHome, 120));
// A window mended before, opened again: shown whole, with no celebration and no sun behind it. A board is made afresh
// each time a window opens, so this one is made once the window is open again.
canvasTest('a window mended before, opened again', SIZE, () => pose((model) => {
    model.openPuzzle(TODAY - 1);
    solve(model);
    model.closePuzzle();
    model.openPuzzle(TODAY - 1);
}, [], CELEBRATED_MS));

function openToday(model: GameModel): void {
    model.openPuzzle(TODAY);
}

/** The level's name, with "a" or "an" before it. */
function withArticle(level: string): string {
    return `${/^[aeiou]/.test(level) ? 'an' : 'a'} ${level}`;
}

/** Returns the board, made once `open` has opened a window, after `play` and `ms`. */
function pose(open: (model: GameModel) => void, play: Play | readonly Play[] = [], ms?: number): Promise<Container> {
    return poseGame((model) => {
        open(model);
        return createBoard(model);
    }, play, ms);
}

/** Returns the board of the open window, wired to the game as the puzzle's screen wires it. */
function createBoard(model: GameModel): Container {
    // The board is made only once a window is open, so its bindings never run without one
    const puzzle = () => model.puzzle!;
    return BoardView({
        puzzle: () => puzzle().puzzle,
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        pieceAt: (tile) => puzzle().pieceAt(tile),
        isLockedAt: (tile) => puzzle().isLockedAt(tile),
        isSolved: () => puzzle().isSolved,
        lastSwappedTile: () => puzzle().lastTileB,
        changes: () => puzzle().changes,
        puzzlesOpened: () => model.puzzlesOpened,
        canSwap: (a, b) => puzzle().canSwap(a, b),
        onSwapRequested: (a, b) => puzzle().swap(a, b),
    });
}
