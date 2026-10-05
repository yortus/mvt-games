import { Container } from 'pixi.js';
import { isTouchDevice, OverlayView } from '#shared';
import { SCREEN_WIDTH, SCREEN_HEIGHT, HUD_HEIGHT, PLAYER_ACCENT_COLOR, OPPONENT_ACCENT_COLOR } from './view-constants';
import type { GameModel } from '../models';
import { ArenaView } from './arena-view';
import { FighterView } from './fighter-view';
import { HudView } from './hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
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
