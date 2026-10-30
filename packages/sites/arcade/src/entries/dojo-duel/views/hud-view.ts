import { Container, Graphics } from 'pixi.js';
import { createComputed, createReaction } from '@mvtjs/utils';
import { PixelTextView } from '#shared';
import type { GamePhase } from '../data';
import { POINTS_TO_WIN_ROUND } from '../data';
import { SCREEN_WIDTH, HUD_HEIGHT, PLAYER_ACCENT_COLOR, OPPONENT_ACCENT_COLOR } from './view-constants';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    playerPoints: () => number;
    opponentPoints: () => number;
    playerRounds: () => number;
    opponentRounds: () => number;
    round: () => number;
    roundTimeRemainingMs: () => number;
    gamePhase: () => GamePhase;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function HudView(bindings: HudViewBindings): Container {
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

    // Timer text (centre), at twice the glyphs' size
    const timerText = createComputed({ watch: timerNumber, compute: (n) => String(n ?? '') });
    const timerLine = PixelTextView({ text: timerText, color: 0xffffff, scale: 2, anchorX: 0.5, anchorY: 0.5 });
    timerLine.position.set(SCREEN_WIDTH / 2, pipY);
    view.addChild(timerLine);

    // Each row of pips is drawn now, and again when its count changes
    const pipRows = [
        { pips: playerPips, count: bindings.playerPoints, colour: PLAYER_ACCENT_COLOR, radius: pipRadius },
        { pips: opponentPips, count: bindings.opponentPoints, colour: OPPONENT_ACCENT_COLOR, radius: pipRadius },
        { pips: playerRoundPips, count: bindings.playerRounds, colour: 0x00ff00, radius: roundPipRadius },
        { pips: opponentRoundPips, count: bindings.opponentRounds, colour: 0xff4444, radius: roundPipRadius },
    ];
    for (let i = 0; i < pipRows.length; i++) drawPipRow(i, pipRows[i].count());
    const drawPipRowWhenItsCountChanges = createReaction({
        watch: pipRows.map((row) => row.count),
        react: (count, _previous, index) => drawPipRow(index, count),
    });

    setRefresh(view, drawPipRowWhenItsCountChanges);
    return view;

    /** The number the timer shows, if any: the seconds left in a fight, and a fixed number in a round's intro. */
    function timerNumber(): number | undefined {
        const phase = bindings.gamePhase();
        if (phase === 'fighting') return Math.max(0, Math.ceil(bindings.roundTimeRemainingMs() / 1000));
        if (phase === 'round-intro') return Math.ceil(POINTS_TO_WIN_ROUND);
        return undefined;
    }

    function drawPipRow(index: number, filledCount: number): void {
        const { pips, colour, radius } = pipRows[index];
        updatePips(pips, filledCount, colour, radius);
    }

    function updatePips(pips: Graphics[], filledCount: number, activeColour: number, radius: number): void {
        for (let i = 0; i < pips.length; i++) {
            pips[i].clear();
            pips[i].circle(0, 0, radius).fill(i < filledCount ? activeColour : 0x444444);
        }
    }
}
