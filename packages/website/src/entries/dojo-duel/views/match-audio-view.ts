import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMusicPlayer, type Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import {
    FIGHT_THEME, type GamePhase, GONG, MATCH_LOST, MATCH_WON, POINT_LOST, POINT_WON, ROUND_LOST, ROUND_WON, TICK,
} from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `MatchAudioView` plays on, and the state of the match it plays the sounds of. */
export interface MatchAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio80;
    /** The game's phase. The view starts and stops the music as it changes. */
    readonly phase: () => GamePhase;
    /** The player's points this round. The view plays three rising notes each time the count rises. */
    readonly playerPoints: () => number;
    /** The opponent's points this round. The view plays three falling notes each time the count rises. */
    readonly opponentPoints: () => number;
    /** The whole seconds left in the round, rounded up. The view ticks as each of the last few begins. */
    readonly secondsLeft: () => number;
    /**
     * Whether the player won the round or the match that has just ended. The
     * view reads it when the phase changes to 'round-over' or 'match-over'.
     */
    readonly hasPlayerWon: () => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many of the round's last seconds tick. */
export const TICKING_SECONDS = 5;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the match's music, and the sounds that do not belong to either
 * fighter. It draws nothing. A gong sounds as each round begins, and then the
 * fight's tune plays. The tune carries on through each point, and starts from
 * the top in each round. Three short notes mark each point. They rise for the
 * player's points and fall for the opponent's. A tick sounds in each of the
 * round's last seconds. A jingle plays as a round or the match is won or
 * lost. The music player's place in the song is the view's presentation
 * state. It advances in the view's update step, so the music pauses with the
 * game.
 */
export function MatchAudioView(bindings: MatchAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'match-audio';
    const music = createMusicPlayer({ audio80: sound });
    // The first poll sees the starting phase as a change, so the game opens with the gong
    const watcher = watch({
        phase: bindings.phase,
        playerPoints: bindings.playerPoints,
        opponentPoints: bindings.opponentPoints,
        secondsLeft: bindings.secondsLeft,
    });

    setUpdate(view, (deltaMs) => music.update(deltaMs));
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const phase = w.phase.value;
        if (w.phase.changed) playPhase(phase, w.phase.previous);
        // A rise in a count is a point. The first poll and a reset to 0 are not
        // rises. When the clock runs out, the side ahead is given the points
        // that end the round. Those points change in the same tick as the
        // phase, and the round's jingle marks them, so they get no notes of
        // their own.
        const isRoundEnding = w.phase.changed && phase === 'round-over';
        if (w.playerPoints.increased && !isRoundEnding) sound.play(POINT_WON);
        if (w.opponentPoints.increased && !isRoundEnding) sound.play(POINT_LOST);
        const seconds = w.secondsLeft;
        if (phase === 'fighting' && seconds.decreased && seconds.value > 0 && seconds.value <= TICKING_SECONDS) {
            sound.play(TICK);
        }
        music.refresh();
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'round-intro':
                music.stop();
                sound.play(GONG);
                break;
            case 'fighting':
                // After a point, the tune carries on. A new round starts it from the top
                if (previous !== 'point-scored') music.play(FIGHT_THEME);
                break;
            case 'round-over':
                music.play(bindings.hasPlayerWon() ? ROUND_WON : ROUND_LOST);
                break;
            case 'match-over':
                music.play(bindings.hasPlayerWon() ? MATCH_WON : MATCH_LOST);
                break;
            case 'point-scored':
                break;
        }
    }
}
