/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import type { LevelModel } from '../models';
import { LevelPaneView } from './level-pane-view';
import { SwitchView } from './switch-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: LevelModel;
    /** Whether the player asked for less motion. It comes from outside the model. */
    readonly isMotionReduced: () => boolean;
    readonly onMotionSwitchToggled?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game, with a switch for less motion, as a game's options menu might
 * have. The setting reaches the pane as a binding beside the model, and the
 * model never knows. Click the game to end a level early.
 */
export function GameView({ model, isMotionReduced, onMotionSwitchToggled }: GameViewBindings): Container {
    return (
        <container>
            <container hitArea={new Rectangle(PANE_X, PANE_Y, 280, 190)} cursor="pointer" onPointerDown={model.endLevel}>
                <LevelPaneView
                    title="Click to end a level early."
                    x={PANE_X}
                    y={PANE_Y}
                    level={() => model.level}
                    phase={() => model.phase}
                    progress={() => model.progress}
                    isMotionReduced={isMotionReduced}
                />
            </container>
            <SwitchView label="Less motion" x={PANE_X} y={PANE_Y + 210} isOn={isMotionReduced} onToggled={onMotionSwitchToggled} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the pane's top left corner is. */
const PANE_X = 180;
const PANE_Y = 60;
