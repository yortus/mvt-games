import { Container, Graphics, Text } from 'pixi.js';
import { watch } from '#common';
import type { GamePhase } from '../data';
import { POINTS_TO_WIN_ROUND } from '../data';
import { SCREEN_WIDTH, HUD_HEIGHT } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getPlayerPoints(): number;
    getOpponentPoints(): number;
    getPlayerRounds(): number;
    getOpponentRounds(): number;
    getRound(): number;
    getRoundTimeRemainingMs(): number;
    getGamePhase(): GamePhase;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    const view = new Container();
    view.label = 'hud';
    view.position.set(0, 0);

    // Background bar
    const bg = new Graphics();
    bg.rect(0, 0, SCREEN_WIDTH, HUD_HEIGHT).fill({ color: 0x000000, alpha: 0.8 });
    view.addChild(bg);

    // Point pips - pre-allocate for both sides
    const pipRadius = 4;
    const pipSpacing = 12;
    const pipY = HUD_HEIGHT / 2;
    const pipMargin = 16;

    const playerPips: Graphics[] = [];
    const opponentPips: Graphics[] = [];

    for (let i = 0; i < POINTS_TO_WIN_ROUND; i++) {
        const pip = new Graphics();
        pip.circle(0, 0, pipRadius).fill(0x444444);
        pip.position.set(pipMargin + i * pipSpacing, pipY);
        view.addChild(pip);
        playerPips.push(pip);
    }

    for (let i = 0; i < POINTS_TO_WIN_ROUND; i++) {
        const pip = new Graphics();
        pip.circle(0, 0, pipRadius).fill(0x444444);
        pip.position.set(SCREEN_WIDTH - pipMargin - (POINTS_TO_WIN_ROUND - 1 - i) * pipSpacing, pipY);
        view.addChild(pip);
        opponentPips.push(pip);
    }

    // Round indicators
    const roundMargin = pipMargin + POINTS_TO_WIN_ROUND * pipSpacing + 8;
    const roundPipRadius = 3;

    const playerRoundPips: Graphics[] = [];
    const opponentRoundPips: Graphics[] = [];

    for (let i = 0; i < 2; i++) {
        const pip = new Graphics();
        pip.circle(0, 0, roundPipRadius).fill(0x444444);
        pip.position.set(roundMargin + i * 10, pipY);
        view.addChild(pip);
        playerRoundPips.push(pip);
    }

    for (let i = 0; i < 2; i++) {
        const pip = new Graphics();
        pip.circle(0, 0, roundPipRadius).fill(0x444444);
        pip.position.set(SCREEN_WIDTH - roundMargin - (1 - i) * 10, pipY);
        view.addChild(pip);
        opponentRoundPips.push(pip);
    }

    // Timer text (centre)
    const timerText = new Text({
        text: '30',
        style: {
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0xffffff,
            align: 'center',
        },
    });
    timerText.anchor.set(0.5);
    timerText.position.set(SCREEN_WIDTH / 2, pipY);
    view.addChild(timerText);

    // Watcher for change detection
    const watcher = watch({
        playerPoints: bindings.getPlayerPoints,
        opponentPoints: bindings.getOpponentPoints,
        playerRounds: bindings.getPlayerRounds,
        opponentRounds: bindings.getOpponentRounds,
        timeSeconds: () => Math.ceil(bindings.getRoundTimeRemainingMs() / 1000),
        phase: bindings.getGamePhase,
    });

    // Cached values for pip colour updates
    let lastPlayerPoints = -1;
    let lastOpponentPoints = -1;
    let lastPlayerRounds = -1;
    let lastOpponentRounds = -1;

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.playerPoints.changed) {
            lastPlayerPoints = watched.playerPoints.value;
            updatePips(playerPips, lastPlayerPoints, 0xffff00, pipRadius);
        }

        if (watched.opponentPoints.changed) {
            lastOpponentPoints = watched.opponentPoints.value;
            updatePips(opponentPips, lastOpponentPoints, 0xff6666, pipRadius);
        }

        if (watched.playerRounds.changed) {
            lastPlayerRounds = watched.playerRounds.value;
            updatePips(playerRoundPips, lastPlayerRounds, 0x00ff00, roundPipRadius);
        }

        if (watched.opponentRounds.changed) {
            lastOpponentRounds = watched.opponentRounds.value;
            updatePips(opponentRoundPips, lastOpponentRounds, 0xff4444, roundPipRadius);
        }

        if (watched.timeSeconds.changed || watched.phase.changed) {
            const phase = watched.phase.value;
            if (phase === 'fighting') {
                timerText.text = String(Math.max(0, watched.timeSeconds.value));
            }
            else if (phase === 'round-intro') {
                timerText.text = String(Math.ceil(POINTS_TO_WIN_ROUND));
            }
            else {
                timerText.text = '';
            }
        }
    }

    function updatePips(pips: Graphics[], filledCount: number, activeColour: number, radius: number): void {
        for (let i = 0; i < pips.length; i++) {
            pips[i].clear();
            pips[i].circle(0, 0, radius).fill(i < filledCount ? activeColour : 0x444444);
        }
    }
}
