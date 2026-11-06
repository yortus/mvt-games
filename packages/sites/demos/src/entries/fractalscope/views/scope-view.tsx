/** @jsxImportSource @mvtjs/html */
import { listenToKeys } from '@mvtjs/site-kit/input';
import { FRACTAL_KINDS } from '../data';
import type { ScopeModel } from '../models';
import { FractalCanvasView } from './fractal-canvas-view';
import { PALETTE_NAMES } from './palette-name';
import { createPictureViewModel } from './picture';
import { SidePanelView } from './side-panel-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ScopeViewBindings {
    readonly model: ScopeModel;
    /** Whether the keyboard works the scope. It doesn't while the scope plays only to be watched. */
    readonly takesKeys: boolean;
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
 * drags and zooms, and the panel a Reset button, and the keys arrive here
 * too. Here they all become the scope's own controls: moving its centre,
 * magnifying about a point, recentring, and travelling and zooming while a
 * key is held. The picture follows the scope by itself. To change what a
 * control does, change it here.
 */
export function ScopeView(bindings: ScopeViewBindings): Element {
    const { model, takesKeys } = bindings;
    let isPanelShown = true;
    const picture = createPictureViewModel({
        fractal: () => model.fractal,
        setting: () => model,
        magnification: () => model.magnification,
        restSetting: () => model.restSetting,
        isScopeMoving: () => model.isMoving,
        measureEscape: model.measureEscape,
    });

    // The same keys as Penrose Tiling's, wherever the two can do the same thing.
    const stopListening = listenToKeys({
        isActive: () => takesKeys,
        pressed: {
            '[': () => stepFractal(-1),
            ']': () => stepFractal(1),
            'c': () => stepPalette(1),
            'C': () => stepPalette(-1),
            'x': surprise,
            'r': model.recentre,
            'h': togglePanel,
            'p': picture.requestPhoto,
        },
        repeating: {},
        held: {
            'ArrowLeft': 'left',
            'a': 'left',
            'ArrowRight': 'right',
            'd': 'right',
            'ArrowUp': 'up',
            'w': 'up',
            'ArrowDown': 'down',
            's': 'down',
            '+': 'zoom in',
            '=': 'zoom in',
            '-': 'zoom out',
            '_': 'zoom out',
        },
        onHeldChanged(isHeld) {
            model.travelRe = (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0);
            model.travelIm = (isHeld('up') ? 1 : 0) - (isHeld('down') ? 1 : 0);
            model.zooming = isHeld('zoom in') === isHeld('zoom out') ? 'none' : isHeld('zoom in') ? 'in' : 'out';
        },
    });

    return (
        <div class="fractalscope" onUpdate={picture.update} onDestroyed={stopListening}>
            <div class="scope-stage">
                <FractalCanvasView
                    field={() => picture.image}
                    setting={() => model}
                    fractal={() => model.fractal}
                    magnification={() => model.magnification}
                    palette={() => picture.palette}
                    photosTaken={() => picture.photosTaken}
                    onResized={picture.resize}
                    onGestureBegan={picture.hold}
                    onGestureEnded={picture.release}
                    onDragged={model.moveCentre}
                    onZoomed={model.magnifyAbout}
                />
                <button
                    type="button"
                    class="scope-show"
                    visible={() => !isPanelShown}
                    text="Controls"
                    title="Show the controls (H)"
                    onClick={togglePanel}
                />
            </div>
            <SidePanelView
                isShown={() => isPanelShown}
                fractal={() => model.fractal}
                setting={() => model}
                magnification={() => model.magnification}
                overview={() => picture.overview}
                aspect={() => picture.image.cols / picture.image.rows}
                maxIterations={() => picture.image.maxIterations}
                progress={() => picture.image.progress}
                palette={() => picture.palette}
                isPhotoPending={() => picture.isPhotoPending}
                onFractalChosen={model.chooseFractal}
                onPaletteChosen={picture.choosePalette}
                onPhotoPressed={picture.requestPhoto}
                onResetPressed={model.recentre}
                onHidePressed={togglePanel}
            />
        </div>
    );

    function stepFractal(by: number): void {
        model.chooseFractal(stepRound(FRACTAL_KINDS, model.fractal, by));
    }

    function stepPalette(by: number): void {
        picture.choosePalette(stepRound(PALETTE_NAMES, picture.palette, by));
    }

    function surprise(): void {
        model.chooseFractal(pickOther(FRACTAL_KINDS, model.fractal));
        picture.choosePalette(pickOther(PALETTE_NAMES, picture.palette));
    }

    function togglePanel(): void {
        isPanelShown = !isPanelShown;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The value `by` places on from `current` in `values`, going round from one end to the other. */
function stepRound<T>(values: readonly T[], current: T, by: number): T {
    return values[(values.indexOf(current) + by + values.length) % values.length];
}

/** Any one of `values` but `current`. */
function pickOther<T>(values: readonly T[], current: T): T {
    const others = values.filter((value) => value !== current);
    return others[Math.floor(Math.random() * others.length)];
}
