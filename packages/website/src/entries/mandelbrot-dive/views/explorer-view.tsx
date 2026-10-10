/** @jsxImportSource @mvtjs/html */
import type { ExplorerModel } from '../models';
import { FractalCanvasView } from './fractal-canvas-view';
import { SidePanelView } from './side-panel-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplorerViewBindings {
    readonly model: ExplorerModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The explorer: the image, filling what it is given, and the panel beside
 * it. On a narrow screen the panel moves below the image. Both follow the
 * one model, and neither knows the other is there.
 */
export function ExplorerView(bindings: ExplorerViewBindings): Element {
    const { model } = bindings;
    return (
        <div class="mandelbrot-dive">
            <div class="dive-stage">
                {FractalCanvasView({
                    field: () => model.field,
                    region: () => model.region,
                    palette: () => model.palette,
                    photosTaken: () => model.photosTaken,
                    onResized: model.resize,
                    onGestureBegan: model.beginGesture,
                    onGestureEnded: model.endGesture,
                    onDragged: model.panBy,
                    onZoomed: model.zoomBy,
                })}
            </div>
            {SidePanelView({
                region: () => model.region,
                overview: () => model.overview,
                aspect: () => model.field.cols / model.field.rows,
                maxIterations: () => model.maxIterations,
                progress: () => model.field.progress,
                palette: () => model.palette,
                isPhotoPending: () => model.isPhotoPending,
                onPaletteChosen: model.choosePalette,
                onPhotoPressed: model.requestPhoto,
                onResetPressed: model.reset,
            })}
        </div>
    );
}
