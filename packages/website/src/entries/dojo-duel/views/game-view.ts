import { Container } from 'pixi.js';
import type { Audio80 } from '@mvtjs/audio';
import { isTouchDevice, OverlayView } from '#shared';
import { SCREEN_WIDTH, SCREEN_HEIGHT, HUD_HEIGHT, PLAYER_ACCENT_COLOR, OPPONENT_ACCENT_COLOR } from './view-constants';
import type { GameModel } from '../models';
import { ArenaView } from './arena-view';
import { FighterView } from './fighter-view';
import { HudView } from './hud-view';
import { FighterAudioView } from './fighter-audio-view';
import { MatchAudioView } from './match-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
    /** The chip that the game's audio views play on. It is an output, so the view reads it once. */
    sound: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function GameView(bindings: GameViewBindings): Container {
    const game = bindings.model;
    const view = new Container();
    view.label = 'dojo-duel-game';

    // HUD at top
    view.addChild(
        HudView({
            playerPoints: () => game.match.playerPoints,
            opponentPoints: () => game.match.opponentPoints,
            playerRounds: () => game.match.playerRounds,
            opponentRounds: () => game.match.opponentRounds,
            round: () => game.match.round,
            roundTimeRemainingMs: () => game.roundTimeRemainingMs,
            gamePhase: () => game.phase,
        }),
    );

    // Arena background (below HUD)
    const arenaContainer = new Container();
    arenaContainer.position.set(0, HUD_HEIGHT);
    arenaContainer.addChild(ArenaView({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - HUD_HEIGHT }));
    view.addChild(arenaContainer);

    // Fighter layer (offset by HUD height; fighter-view sets its own
    // position internally, so a wrapper container carries the offset)
    const fighterLayer = new Container();
    fighterLayer.position.set(0, HUD_HEIGHT);
    view.addChild(fighterLayer);

    // Player fighter
    fighterLayer.addChild(
        FighterView({
            x: () => game.player.x,
            height: () => game.player.height,
            facing: () => game.player.facing,
            phase: () => game.player.phase,
            move: () => game.player.move,
            progress: () => game.player.progress,
            defeatVariant: () => game.player.defeatVariant,
            accentColor: PLAYER_ACCENT_COLOR,
        }),
    );

    // Opponent fighter
    fighterLayer.addChild(
        FighterView({
            x: () => game.opponent.x,
            height: () => game.opponent.height,
            facing: () => game.opponent.facing,
            phase: () => game.opponent.phase,
            move: () => game.opponent.move,
            progress: () => game.opponent.progress,
            defeatVariant: () => game.opponent.defeatVariant,
            accentColor: OPPONENT_ACCENT_COLOR,
        }),
    );

    // The sounds of each fighter and of the match
    view.addChild(
        FighterAudioView({
            sound: bindings.sound,
            phase: () => game.player.phase,
            move: () => game.player.move,
        }),
        FighterAudioView({
            sound: bindings.sound,
            phase: () => game.opponent.phase,
            move: () => game.opponent.move,
        }),
        MatchAudioView({
            sound: bindings.sound,
            phase: () => game.phase,
            playerPoints: () => game.match.playerPoints,
            opponentPoints: () => game.match.opponentPoints,
            secondsLeft: () => Math.ceil(game.roundTimeRemainingMs / 1000),
            hasPlayerWon: () => (game.phase === 'match-over'
                ? game.match.getMatchWinner()
                : game.match.getRoundWinner()) === 'player',
        }),
    );

    // Overlay
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    view.addChild(
        OverlayView({
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            isVisible: () => game.phase === 'round-intro'
                || game.phase === 'match-over',
            text: () => resolveOverlayText(game, restartHint),
            onRestartPressed: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        }),
    );

    return view;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOverlayText(game: GameModel, restartHint: string): string {
    if (game.phase === 'round-intro') {
        return `Round ${game.match.round}`;
    }
    if (game.phase === 'match-over') {
        const winner = game.match.getMatchWinner();
        const winnerLabel = winner === 'player' ? 'You win!' : 'You lose!';
        return `GAME OVER\n\n${winnerLabel}\n\n${restartHint}`;
    }
    return '';
}
