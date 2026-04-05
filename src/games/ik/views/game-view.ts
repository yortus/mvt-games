import { Container } from 'pixi.js';
import { createOverlayView, isTouchDevice } from '#common';
import { SCREEN_WIDTH, SCREEN_HEIGHT, HUD_HEIGHT } from './view-constants';
import type { GameModel } from '../models';
import { createArenaView } from './arena-view';
import { createFighterView } from './fighter-view';
import { createHudView } from './hud-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGameView(game: GameModel): Container {
    const view = new Container();
    view.label = 'ik-game';

    // HUD at top
    view.addChild(
        createHudView({
            getPlayerPoints: () => game.match.playerPoints,
            getOpponentPoints: () => game.match.opponentPoints,
            getPlayerRounds: () => game.match.playerRounds,
            getOpponentRounds: () => game.match.opponentRounds,
            getRound: () => game.match.round,
            getRoundTimeRemainingMs: () => game.roundTimeRemainingMs,
            getGamePhase: () => game.phase,
        }),
    );

    // Arena background (below HUD)
    const arenaContainer = new Container();
    arenaContainer.position.set(0, HUD_HEIGHT);
    arenaContainer.addChild(createArenaView(SCREEN_WIDTH, SCREEN_HEIGHT - HUD_HEIGHT));
    view.addChild(arenaContainer);

    // Fighter layer (offset by HUD height; fighter-view sets its own
    // position internally, so a wrapper container carries the offset)
    const fighterLayer = new Container();
    fighterLayer.position.set(0, HUD_HEIGHT);
    view.addChild(fighterLayer);

    // Player fighter
    fighterLayer.addChild(
        createFighterView({
            getX: () => game.player.x,
            getHeight: () => game.player.height,
            getFacing: () => game.player.facing,
            getPhase: () => game.player.phase,
            getMove: () => game.player.move,
            getProgress: () => game.player.progress,
            getDefeatVariant: () => game.player.defeatVariant,
            getTint: () => 0xffffff,
        }),
    );

    // Opponent fighter
    fighterLayer.addChild(
        createFighterView({
            getX: () => game.opponent.x,
            getHeight: () => game.opponent.height,
            getFacing: () => game.opponent.facing,
            getPhase: () => game.opponent.phase,
            getMove: () => game.opponent.move,
            getProgress: () => game.opponent.progress,
            getDefeatVariant: () => game.opponent.defeatVariant,
            getTint: () => 0xff6666,
        }),
    );

    // Overlay
    const restartHint = isTouchDevice() ? 'Tap to restart' : 'Press Enter to restart';
    view.addChild(
        createOverlayView({
            getWidth: () => SCREEN_WIDTH,
            getHeight: () => SCREEN_HEIGHT,
            getVisible: () => game.phase === 'round-intro'
                || game.phase === 'match-over',
            getText: () => resolveOverlayText(game, restartHint),
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
