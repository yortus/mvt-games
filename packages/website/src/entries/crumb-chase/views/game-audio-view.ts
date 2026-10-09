import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMusicPlayer, type Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { CAUGHT, CLEARED, GAME_START, NIBBLE_HIGH, NIBBLE_LOW, SNEAK } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** The game's phase. The view starts the music for each phase as it changes. */
    readonly phase: () => GamePhase;
    /** How many crumbs are left in the maze. Each fall is a crumb eaten. */
    readonly remainingCrumbs: () => number;
    /** How many crumbs a full maze has. The game has one maze, so the view reads it once. */
    readonly totalCrumbs: number;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/**
 * How much faster the sneaking tune plays with the maze empty than full, as a
 * share of its own tempo. The tune speeds up in step with the crumbs eaten.
 */
export const SNEAK_SPEED_UP = 0.6;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's music and its nibbles. It draws nothing. As a game starts,
 * it plays a short tune and then the sneaking tune, which speeds up as the
 * maze empties. It plays a nibble for each crumb eaten. The nibbles go low and
 * high by turns, by whether the crumbs left are odd or even, so the view keeps
 * no count of its own. It plays a falling tune when the mouse is caught, and a
 * bright one when the maze is cleared. The music player's place in the song is
 * the view's presentation state. It advances in the view's update step, so
 * the music pauses with the game.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound, totalCrumbs } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const music = createMusicPlayer({ audio80: sound });
    const watcher = watch({ phase: bindings.phase, remainingCrumbs: bindings.remainingCrumbs });

    setUpdate(view, (deltaMs) => {
        music.tempoScale = computeTempoScale();
        music.update(deltaMs);
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        // The first poll sees the starting phase as a change, so the game opens with the start's tune
        if (w.phase.changed) playPhase(w.phase.value);
        // A fall is a crumb eaten. The first poll and the rise as a new game starts are not falls
        const crumbs = w.remainingCrumbs;
        if (crumbs.decreased) sound.play(crumbs.value % 2 === 0 ? NIBBLE_LOW : NIBBLE_HIGH);
        music.refresh();
    }

    function playPhase(phase: GamePhase): void {
        // A game can end during the start's tune. Playing the end's tune cancels the sneaking tune queued
        switch (phase) {
            case 'playing':
                music.play(GAME_START);
                music.queue(SNEAK);
                break;
            case 'game-over':
                music.play(CAUGHT);
                break;
            case 'won':
                music.play(CLEARED);
                break;
        }
    }

    /** Returns the sneaking tune's tempo for the crumbs left, or 1 for every other song. */
    function computeTempoScale(): number {
        if (music.song !== SNEAK) return 1;
        return 1 + (1 - bindings.remainingCrumbs() / totalCrumbs) * SNEAK_SPEED_UP;
    }
}
