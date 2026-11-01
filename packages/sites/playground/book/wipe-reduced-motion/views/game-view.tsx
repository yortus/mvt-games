/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import type { LevelModel } from '../models';
import { LevelPaneView } from './level-pane-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: LevelModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The same game, shown twice: once for a player with full motion, and once
 * for a player who asked for less. Both panes follow the same model, so
 * each wipe starts, changes the level and ends at the same moment in both.
 * Only the look differs. Click to end a level early.
 */
export function GameView({ model, width, height }: GameViewBindings): Container {
    return (
        <container hitArea={new Rectangle(0, 0, width, height)} cursor="pointer" onPointerDown={model.endLevel}>
            <LevelPaneView
                title="Full motion"
                x={30}
                y={100}
                level={() => model.level}
                phase={() => model.phase}
                progress={() => model.progress}
                isMotionReduced={() => false}
            />
            <LevelPaneView
                title="Less motion"
                x={330}
                y={100}
                level={() => model.level}
                phase={() => model.phase}
                progress={() => model.progress}
                isMotionReduced={() => true}
            />
            <text text="Click to end a level early." x={width / 2} y={330} anchor={0.5} style={HINT_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
