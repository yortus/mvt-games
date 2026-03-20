import { Container } from 'pixi.js';
import { createKeyboardInputView, createOverlayView } from '#common';
import { SCREEN_WIDTH, SCREEN_HEIGHT, HUD_HEIGHT } from '../data';
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
            getPlayerPoints: () => game.score.playerPoints,
            getOpponentPoints: () => game.score.opponentPoints,
            getPlayerRounds: () => game.score.playerRounds,
            getOpponentRounds: () => game.score.opponentRounds,
            getRound: () => game.score.round,
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
    view.addChild(
        createOverlayView({
            getWidth: () => SCREEN_WIDTH,
            getHeight: () => SCREEN_HEIGHT,
            isVisible: () => game.phase === 'round-intro' ||
                game.phase === 'match-over',
            getText: () => resolveOverlayText(game),
        }),
    );

    // Keyboard input
    view.addChild(
        createKeyboardInputView({
            onXDirectionChanged: (dir) => {
                game.playerInput.xDirection = dir;
            },
            onYDirectionChanged: (dir) => {
                game.playerInput.yDirection = dir;
            },
            onPrimaryButtonChanged: (pressed) => {
                game.playerInput.attackPressed = pressed;
            },
            onRestartButtonChanged: (pressed) => {
                game.playerInput.restartPressed = pressed;
            },
        }),
    );

    return view;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOverlayText(game: GameModel): string {
    if (game.phase === 'round-intro') {
        return `Round ${game.score.round}`;
    }
    if (game.phase === 'match-over') {
        const winner = game.score.getMatchWinner();
        const winnerLabel = winner === 'player' ? 'You win!' : 'You lose!';
        return `GAME OVER\n\n${winnerLabel}\n\nPress Enter to restart`;
    }
    return '';
}
