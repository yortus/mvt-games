import { Container, Text } from 'pixi.js';
import { createKeyboardInputView } from '#common';
import { SCREEN_WIDTH, SCREEN_HEIGHT, resolveInputDirection, resolveMove } from '../data';
import type { FighterModel, PlayerInput } from '../models';
import { createArenaView } from './arena-view';
import { createFighterView } from './fighter-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Temporary top-level harness view for playtesting a single fighter
 * with keyboard input. Will be replaced by the full game-view in Stage 6.
 */
export function createPlaytestView(fighter: FighterModel, playerInput: PlayerInput): Container {
    let lastXDir: 'left' | 'none' | 'right' = 'none';
    let lastYDir: 'up' | 'none' | 'down' = 'none';

    const view = new Container();
    view.label = 'playtest';

    // Arena background
    view.addChild(createArenaView(SCREEN_WIDTH, SCREEN_HEIGHT));

    // Fighter view (player, no tint)
    view.addChild(
        createFighterView({
            getX: () => fighter.x,
            getHeight: () => fighter.height,
            getFacing: () => fighter.facing,
            getPhase: () => fighter.phase,
            getMove: () => fighter.move,
            getProgress: () => fighter.progress,
            getDefeatVariant: () => fighter.defeatVariant,
            getTint: () => 0xffffff, // no tint
        }),
    );

    // Debug overlay
    const debugText = new Text({
        text: '',
        style: {
            fontFamily: 'monospace',
            fontSize: 10,
            fill: 0xffffff,
        },
    });
    debugText.position.set(4, 4);
    view.addChild(debugText);

    // Keyboard input
    view.addChild(
        createKeyboardInputView({
            onXDirectionChanged: (dir) => {
                lastXDir = dir;
                playerInput.xDirection = dir;
            },
            onYDirectionChanged: (dir) => {
                lastYDir = dir;
                playerInput.yDirection = dir;
            },
            onPrimaryButtonChanged: (pressed) => {
                playerInput.attackPressed = pressed;
            },
            onRestartButtonChanged: (pressed) => {
                playerInput.restartPressed = pressed;
            },
        }),
    );

    view.onRender = refresh;
    return view;

    function refresh(): void {
        // Update debug overlay
        const inputDir = resolveInputDirection(lastXDir, lastYDir, fighter.facing);
        const move = resolveMove(inputDir, false);
        debugText.text =
            `phase: ${fighter.phase}  move: ${fighter.move ?? '-'}  progress: ${fighter.progress.toFixed(2)}\n` +
            `facing: ${fighter.facing}  input: ${inputDir}  resolved: ${move}  x: ${fighter.x.toFixed(2)}  h: ${fighter.height.toFixed(2)}`;
    }
}
