import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { BIG_MATCH, CASCADE_FANFARES, FIREWORKS, GAME_OVER, LAND, MATCH_BURST, NEW_GAME, SWAP, SWAP_BACK } from '../data';
import type { BoardPhase, GamePhase } from '../models';
import { MIN_CASCADE_FOR_FIREWORKS, MIN_CELLS_FOR_BIG_MATCH } from './view-constants';

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
    /** The cascade's step. It is 1 for a swap's own match, and 2 or more for each match that follows as the cactii fall. */
    readonly cascadeStep: () => number;
    /** How many cactii the current match clears, counting every line in it. */
    readonly matchedCellCount: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's sound effects. The game has no music. A swap whoops, and a swap
 * that is undone knocks twice. Each match bursts and plays a brass fanfare,
 * a step higher for each step of a cascade. A match that clears five or
 * more cactii also sparkles, and a long cascade sets off fireworks. The
 * cactii tock as they land, and a few notes mark a new board and the end of
 * the game.
 *
 * The view draws nothing and keeps no state. Every sound it plays is a
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
                sound.play(SWAP);
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
        sound.play(MATCH_BURST);
        sound.play(CASCADE_FANFARES[Math.min(Math.max(step, 1), CASCADE_FANFARES.length) - 1]);
        if (bindings.matchedCellCount() >= MIN_CELLS_FOR_BIG_MATCH) sound.play(BIG_MATCH);
        if (step >= MIN_CASCADE_FOR_FIREWORKS) sound.play(FIREWORKS);
    }
}
