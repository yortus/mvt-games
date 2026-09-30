/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import type { FrameStats } from '../../../pixi-mvt';
import type { DemoModel, GrainStorageKind, TankSizeKind } from '../models';
import { type GrainsViewKind, TankView } from './tank-view';
import { ToolbarView } from './toolbar-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    model: DemoModel;
    /** How to draw the grains. Read once, when the view is built. */
    grainsView: GrainsViewKind;
    /**
     * Draw the grains with SolidJS effects rather than by polling. Defaults to
     * doing so exactly when the model is a `'store'`, the one storage whose
     * reads are tracked. Set it to false with a store to measure the store
     * alone, polled like the others.
     */
    isReactive?: boolean;
    /** The size the tank was made at, to show on its switch. */
    tankSize: TankSizeKind;
    /** Frame timing to show, or undefined where there is none (e.g. rendering a thumbnail). */
    frameStats: () => FrameStats | undefined;
    /**
     * A switch asked for a different storage, grains view or tank size.
     * Implementations are fixed for the demo's life, so whoever handles
     * these starts a new demo with the new choice.
     */
    onStoragePressed?: (storage: GrainStorageKind) => void;
    onGrainsViewPressed?: (grainsView: GrainsViewKind) => void;
    onTankSizePressed?: (tankSize: TankSizeKind) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole demo: the tank above, the toolbar below. The top-level view, so
 * it takes the model itself and wires it to the views below: what they show,
 * and what their gestures do.
 *
 * A store model gets the SolidJS versions of the grain views, since those are
 * what a store is for; the other models get the polled ones.
 */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model } = bindings;
    const isReactive = bindings.isReactive ?? model.storage === 'store';
    return (
        <container label="falling-sand">
            <ToolbarView
                selectedTool={() => model.tool}
                canFlip={() => model.phase === 'running'}
                grainCount={() => model.grainCount}
                movingCount={() => model.movingCount}
                frameStats={bindings.frameStats}
                storage={model.storage}
                grainsView={bindings.grainsView}
                isReactive={isReactive}
                tankSize={bindings.tankSize}
                onToolPressed={(tool) => { model.tool = tool; }}
                onFlipPressed={() => model.flip()}
                onResetPressed={() => model.reset()}
                onClearPressed={() => model.clear()}
                onStoragePressed={bindings.onStoragePressed}
                onGrainsViewPressed={bindings.onGrainsViewPressed}
                onTankSizePressed={bindings.onTankSizePressed}
            />
            {/* Last, so a flipping tank turns in front of the toolbar. */}
            <TankView
                cols={model.cols}
                rows={model.rows}
                grains={() => model.grains}
                grainsView={bindings.grainsView}
                isReactive={isReactive}
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
