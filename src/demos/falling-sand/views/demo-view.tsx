/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import type { FrameStats } from '#common';
import type { DemoModel, GrainStorageKind, TankSizeKind } from '../models';
import { type GrainsViewKind, TankView } from './tank-view';
import { ToolbarView } from './toolbar-view';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DemoViewProps {
    model: DemoModel;
    /** How to draw the grains. Read once, when the view is built. */
    grainsView: GrainsViewKind;
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
// Component
// ---------------------------------------------------------------------------

/**
 * The whole demo: the tank above, the toolbar below. The top-level view, so
 * it takes the model itself and wires it to the views below: what they show,
 * and what their gestures do.
 */
export function DemoView(props: DemoViewProps): Container {
    const { model } = props;
    return (
        <container label="falling-sand">
            <ToolbarView
                selectedTool={() => model.tool}
                canFlip={() => model.phase === 'running'}
                grainCount={() => model.grainCount}
                movingCount={() => model.movingCount}
                frameStats={props.frameStats}
                storage={model.storage}
                grainsView={props.grainsView}
                tankSize={props.tankSize}
                onToolPressed={(tool) => { model.tool = tool; }}
                onFlipPressed={() => model.flip()}
                onResetPressed={() => model.reset()}
                onClearPressed={() => model.clear()}
                onStoragePressed={props.onStoragePressed}
                onGrainsViewPressed={props.onGrainsViewPressed}
                onTankSizePressed={props.onTankSizePressed}
            />
            {/* Last, so a flipping tank turns in front of the toolbar. */}
            <TankView
                cols={model.cols}
                rows={model.rows}
                grains={() => model.grains}
                grainsView={props.grainsView}
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
