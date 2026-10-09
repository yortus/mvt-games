import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMusicPlayer, type Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { GAME_OVER, RESPAWN, SHIP_HIT, SHOT, STAGE_CLEAR, STAGE_FANFARE, STAGE_TUNE } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** The game's phase. The view starts and stops the music as it changes. */
    readonly phase: () => GamePhase;
    /** Shots fired this game. The view plays a shot each time the count rises. */
    readonly shotsFired: () => number;
    /** How many raiders are still alive. The tune speeds up when few are left. */
    readonly enemiesLeft: () => number;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** With this many raiders left or fewer, the stage's tune speeds up. */
export const HURRY_AT_MOST = 5;

/** The tune's tempo while it speeds up, as a multiple of its own. */
export const HURRY_TEMPO = 1.15;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's music, and the sounds that do not belong to any one raider.
 * It draws nothing. As each stage starts, it plays a fanfare and then the
 * stage's tune. It plays a jingle when a stage is cleared, and a slow tune
 * when the game is over. It also plays the ship's shots, its loss and its
 * return. It plays a sound only when a poll of its bindings sees a change, so
 * a second refresh in the same tick plays nothing. The music player's place in
 * the song is the view's presentation state. It advances in the view's update
 * step, so the music pauses with the game.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const music = createMusicPlayer({ audio80: sound });
    const watcher = watch({ phase: bindings.phase, shots: bindings.shotsFired });

    setUpdate(view, (deltaMs) => {
        music.tempoScale = music.song === STAGE_TUNE && bindings.enemiesLeft() <= HURRY_AT_MOST ? HURRY_TEMPO : 1;
        music.update(deltaMs);
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        // The first poll sees the starting phase as a change, so the game opens with the fanfare
        if (w.phase.changed) playPhase(w.phase.value, w.phase.previous);
        // A rise in the count is a shot. The first poll and a reset to 0 on a restart are not rises
        if (w.shots.increased) sound.play(SHOT);
        music.refresh();
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                if (previous === 'dying') {
                    sound.play(RESPAWN);
                    music.play(STAGE_TUNE);
                }
                else {
                    music.play(STAGE_FANFARE);
                    music.queue(STAGE_TUNE);
                }
                break;
            case 'dying':
                music.stop();
                sound.play(SHIP_HIT);
                break;
            case 'stage-clear':
                music.play(STAGE_CLEAR);
                break;
            case 'game-over':
                music.play(GAME_OVER);
                break;
        }
    }
}
