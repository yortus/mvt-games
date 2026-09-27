/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import type { FrameStats } from '#common';
import type { DemoModel } from './demo-model';
import { TankView } from './tank-view';
import { ToolbarView } from './toolbar-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    model: DemoModel;
    /** Frame timing to show, or undefined where there is none (e.g. rendering a thumbnail). */
    frameStats: () => FrameStats | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole demo: the tank above, the toolbar below. The top-level view, so
 * it takes the model itself and wires it to the views below: what they show,
 * and what their gestures do.
 */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model } = bindings;
    return (
        <container label="falling-sand">
            <ToolbarView
                selectedTool={() => model.tool}
                canFlip={() => model.phase === 'running'}
                grainCount={() => model.grainCount}
                movingCount={() => model.movingCount}
                frameStats={bindings.frameStats}
                onToolPressed={(tool) => { model.tool = tool; }}
                onFlipPressed={() => model.flip()}
                onResetPressed={() => model.reset()}
                onClearPressed={() => model.clear()}
            />
            {/* Last, so a flipping tank turns in front of the toolbar. */}
            <TankView
                cols={model.cols}
                rows={model.rows}
                grains={() => model.grains}
                flipProgress={() => model.flipProgress}
                isFlipping={() => model.phase === 'flipping'}
                isPouring={() => model.isPouring}
                brushRadius={() => model.brushRadius}
                onPressed={(col, row) => model.startPour(col, row)}
                onMoved={(col, row) => model.movePour(col, row)}
                onReleased={() => model.endPour()}
            />
        </container>
    );
}
