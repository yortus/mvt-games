import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, increased } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import { GAME_OVER, RESPAWN, SHIP_HIT, SHOT, STAGE_CLEAR, STAGE_FANFARE, STAGE_TUNE } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
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
 * As each stage starts, it plays a fanfare and then the stage's tune. It plays
 * a jingle when a stage is cleared, and a slow tune when the game is over. It
 * also plays the ship's shots, its loss and its return. It plays a sound only
 * when a poll of its bindings sees a change, so a second refresh in the same
 * tick plays nothing. Which tune plays, and how fast, is the view's
 * presentation state. The chip's own sequencer keeps the tune's place, and it
 * pauses with the game.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { music, sfx } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const playSoundsWhenPhaseChanges = createReaction({ watch: bindings.phase, react: playPhase });
    // A rise in the count is a shot. A reset to 0 on a restart is not a rise
    const playShotSoundOnEachShot = createReaction({
        watch: bindings.shotsFired,
        when: increased,
        react: () => sfx.play(SHOT),
    });
    // The view is made as the game starts, so the game opens with the fanfare
    playPhase(bindings.phase(), undefined);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        playSoundsWhenPhaseChanges();
        playShotSoundOnEachShot();
        // After any new song, so the tempo is the one for the song that plays. It is sent ahead of the song
        music.tempoScale = music.song === STAGE_TUNE && bindings.enemiesLeft() <= HURRY_AT_MOST ? HURRY_TEMPO : 1;
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                if (previous === 'dying') {
                    sfx.play(RESPAWN);
                    music.play(STAGE_TUNE);
                }
                else {
                    music.play(STAGE_FANFARE);
                    music.queue(STAGE_TUNE);
                }
                break;
            case 'dying':
                music.stop();
                sfx.play(SHIP_HIT);
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
