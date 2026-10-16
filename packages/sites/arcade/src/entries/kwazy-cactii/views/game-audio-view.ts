import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { BIG_MATCH, CASCADE_CRACKLES, CASCADE_WHISTLES, GAME_OVER, LAND, NEW_GAME, SWAP, SWAP_BACK } from '../data';
import type { BoardPhase, GamePhase } from '../models';
import { MIN_CELLS_FOR_BIG_MATCH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the game's audio view reads from the game, and the chip it plays on. */
export interface GameAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** The game's phase. The view plays the notes for a new game and for the end as it changes. */
    readonly gamePhase: () => GamePhase;
    /** The board's phase. The view plays the moves, the matches and the landings as it changes. */
    readonly boardPhase: () => BoardPhase;
    /** Whether the swap now under way makes a line. A swap that will be undone makes no sound of its own. */
    readonly isSwapMatching: () => boolean;
    /** The cascade's step. It is 1 for a swap's own match, and 2 or more for each match that follows as the cactii fall. */
    readonly cascadeStep: () => number;
    /** How many cactii the current match clears, counting every line in it. */
    readonly matchedCellCount: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's sound effects. The game has no music. A swap that makes a line
 * blips as it starts, and one that makes none says nothing until it knocks
 * twice as it is undone. Each match whistles, a step higher for each step of
 * a cascade, and the steps that set off fireworks crackle over the whistle as
 * they burst, higher again at each step. A match that clears five or more cactii also
 * sparkles. The cactii tock as they land, and a few notes mark a new board
 * and the end of the game.
 *
 * The view keeps no state. Every sound it plays is a
 * change in the game's phase or the board's.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    // The view does not poll here. Its first poll sees the game's first phase as a change, and plays a new game's notes.
    const watcher = watch({ gamePhase: bindings.gamePhase, boardPhase: bindings.boardPhase });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.gamePhase.changed) {
            if (w.gamePhase.value === 'playing') sound.play(NEW_GAME);
            else sound.play(GAME_OVER);
        }
        // The first poll has no previous board phase. The board starts idle, so nothing has happened on it yet.
        if (w.boardPhase.changed && w.boardPhase.previous !== undefined) playBoardPhase(w.boardPhase.value, w.boardPhase.previous);
    }

    function playBoardPhase(phase: BoardPhase, previous: BoardPhase): void {
        if (previous === 'settling') sound.play(LAND);
        switch (phase) {
            case 'swapping':
                // A swap that makes no line says nothing here. It knocks as it is undone, which is the answer to the move
                if (bindings.isSwapMatching()) sound.play(SWAP);
                break;
            case 'reversing':
                sound.play(SWAP_BACK);
                break;
            case 'matching':
                playMatch();
                break;
            case 'idle':
            case 'settling':
                break;
        }
    }

    function playMatch(): void {
        const step = bindings.cascadeStep();
        const index = Math.min(Math.max(step, 1), CASCADE_WHISTLES.length) - 1;
        sound.play(CASCADE_WHISTLES[index]);
        // The crackle is an effect of its own, so it bursts over the whistle on another voice instead of cutting it off
        const crackle = CASCADE_CRACKLES[index];
        if (crackle !== undefined) sound.play(crackle);
        if (bindings.matchedCellCount() >= MIN_CELLS_FOR_BIG_MATCH) sound.play(BIG_MATCH);
    }
}
