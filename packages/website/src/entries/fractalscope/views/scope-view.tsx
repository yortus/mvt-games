/** @jsxImportSource @mvtjs/html */
import type { ScopeModel } from '../models';
import { FractalCanvasView } from './fractal-canvas-view';
import { createPictureViewModel } from './picture';
import { SidePanelView } from './side-panel-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScopeViewBindings {
    readonly model: ScopeModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The scope, as the visitor sees and works it: the picture, filling what it
 * is given, and the panel beside it. On a narrow screen the panel moves
 * below the picture.
 *
 * It owns the picture's view model, which the canvas, the panel and the
 * minimap share. The picture, the palette and a photo asked for are
 * presentation, so they live here rather than in the model, and they advance
 * in this view's update step.
 *
 * It is also where the visitor's words meet the scope's. The canvas reports
 * drags and zooms, and the panel a Reset button. Here they become the
 * scope's own controls: moving its centre, magnifying about a point, and
 * recentring. The picture follows the scope by itself.
 */
export function ScopeView(bindings: ScopeViewBindings): Element {
    const { model } = bindings;
    const picture = createPictureViewModel({
        fractal: () => model.fractal,
        setting: () => model,
        magnification: () => model.magnification,
        restSetting: () => model.restSetting,
        measureEscape: model.measureEscape,
    });

    return (
        <div class="fractalscope" onUpdate={picture.update}>
            <div class="scope-stage">
                {FractalCanvasView({
                    field: () => picture.image,
                    setting: () => model,
                    fractal: () => model.fractal,
                    magnification: () => model.magnification,
                    palette: () => picture.palette,
                    photosTaken: () => picture.photosTaken,
                    onResized: picture.resize,
                    onGestureBegan: picture.hold,
                    onGestureEnded: picture.release,
                    onDragged: model.moveCentre,
                    onZoomed: model.magnifyAbout,
                })}
            </div>
            {SidePanelView({
                fractal: () => model.fractal,
                setting: () => model,
                magnification: () => model.magnification,
                overview: () => picture.overview,
                aspect: () => picture.image.cols / picture.image.rows,
                maxIterations: () => picture.image.maxIterations,
                progress: () => picture.image.progress,
                palette: () => picture.palette,
                isPhotoPending: () => picture.isPhotoPending,
                onFractalChosen: model.chooseFractal,
                onPaletteChosen: picture.choosePalette,
                onPhotoPressed: picture.requestPhoto,
                onResetPressed: model.recentre,
            })}
        </div>
    );
}
