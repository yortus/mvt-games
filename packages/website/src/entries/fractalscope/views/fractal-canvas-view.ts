import { onDestroyed, setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { FractalKind, ScopeSetting } from '../data';
import type { PaletteName } from './palette-name';
import type { EscapeGrid } from './picture';
import { buildPaletteColors, paintEscapes, type PaletteColors } from './palettes';
import { createPinchTracker } from './pinch-tracker';
import { countDigits } from './readouts';
import { BACKDROP_COLOR, MAX_SAMPLE_DENSITY, MAX_SAMPLES } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FractalCanvasViewBindings {
    /** The picture being computed, and the scope setting it was taken at. */
    field: () => EscapeGrid;
    /** The scope's setting now, which a gesture changes before the picture follows. */
    setting: () => ScopeSetting;
    /** The fractal under the scope, which names a photo. */
    fractal: () => FractalKind;
    /** How strongly the scope magnifies, which names a photo too. */
    magnification: () => number;
    /** The colours the image is drawn in. */
    palette: () => PaletteName;
    /** Rises each time a photo is ready. The view then saves what it shows. */
    photosTaken: () => number;
    /** The view is now `cols` by `rows` samples. */
    onResized?: (cols: number, rows: number) => void;
    /** A finger or the mouse went down on the view, with nothing already held. */
    onGestureBegan?: () => void;
    /** The last finger or button came off the view. */
    onGestureEnded?: () => void;
    /** The view was dragged by `deltaRe` and `deltaIm`, in units of the complex plane. */
    onDragged?: (deltaRe: number, deltaIm: number) => void;
    /** The view was zoomed by `factor` about the point `re` + `im`i. Above 1 is closer in. */
    onZoomed?: (factor: number, re: number, im: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The picture, on a canvas that fills whatever it is given, and the fingers
 * and mouse that work the scope.
 *
 * It keeps the picture it has coloured on a canvas of its own, one pixel per
 * sample. Each frame it colours the rows that changed, and draws the picture
 * onto the screen, scaled and shifted from the setting it was taken at to the
 * scope's setting now. While a gesture runs, the scope's setting changes and
 * the picture does not. So the picture is stretched to fit, and turns blocky
 * as the scope closes in. Once the gesture ends, the picture is taken again
 * and sharpens in place.
 *
 * It speaks in gestures, drags and zooms in CSS pixels, turned into moves in
 * the complex plane. Whoever wires it up turns those into the scope's own
 * controls. The canvas's size and colours are this view's own.
 */
export function FractalCanvasView(bindings: FractalCanvasViewBindings): Element {
    const canvas = document.createElement('canvas');
    canvas.className = 'scope-image';
    // The view does its own zooming and panning, so the browser's are off.
    canvas.style.touchAction = 'none';
    // A test environment has no canvas to draw on. Everything else still works.
    const screen = canvas.getContext('2d') ?? undefined;

    // The picture as coloured, one pixel per sample.
    const picture = document.createElement('canvas');
    const paper = picture.getContext('2d') ?? undefined;
    let image: ImageData | undefined;
    let pixels: Int32Array | undefined;
    let paintedCols = 0;
    let paintedRows = 0;
    // The field's revision when the picture was last coloured.
    let paintedRevision = -1;

    // Where the picture was last drawn on the screen, so that a still view
    // is not drawn again.
    let drawnX = Number.NaN;
    let drawnY = Number.NaN;
    let drawnWidth = Number.NaN;

    let colors: PaletteColors = buildPaletteColors(bindings.palette());
    // The last photo saved. Its URL is held until the next one, because
    // letting go of it while the browser is still saving cancels the save.
    let photoUrl: string | undefined;
    // The canvas's size in CSS pixels, which the gestures are measured in.
    let cssWidth = 0;
    let cssHeight = 0;

    const watcher = watch({
        palette: bindings.palette,
        photos: bindings.photosTaken,
    });

    const tracker = createPinchTracker({
        element: canvas,
        onGestureBegan: () => bindings.onGestureBegan?.(),
        onGestureEnded: () => bindings.onGestureEnded?.(),
        onDragged: reportDrag,
        onZoomed: reportZoom,
    });

    // The image is computed on as many samples as the canvas can show.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);

    setRefresh(canvas, refresh);
    onDestroyed(canvas, () => {
        resizeObserver.disconnect();
        tracker.destroy();
        if (photoUrl !== undefined) URL.revokeObjectURL(photoUrl);
    });
    return canvas;

    function refresh(): void {
        const field = bindings.field();
        const changes = watcher.poll();
        // The canvas has a pixel per sample. Resizing it clears it, and the
        // picture is then coloured and drawn again whole.
        if (canvas.width !== field.cols) canvas.width = field.cols;
        if (canvas.height !== field.rows) canvas.height = field.rows;
        if (screen !== undefined && paper !== undefined) {
            const isPainted = paintPicture(paper, field, changes.palette.changed);
            drawPicture(screen, field, isPainted);
        }
        // After drawing, so the photo holds this frame.
        if (changes.photos.increased) savePhoto();
    }

    /**
     * Colours what has changed into the picture. A new size or a new palette
     * colours all of it. Otherwise only the rows changed since it was last
     * coloured are. Returns whether it coloured anything.
     */
    function paintPicture(context: CanvasRenderingContext2D, field: EscapeGrid, isNewPalette: boolean): boolean {
        const cols = field.cols;
        const rows = field.rows;
        let isWhole = isNewPalette;
        if (cols !== paintedCols || rows !== paintedRows) {
            resizePicture(context, cols, rows);
            isWhole = true;
        }
        if (isNewPalette) colors = buildPaletteColors(bindings.palette());
        if (image === undefined || pixels === undefined) return false;

        if (isWhole) {
            paintEscapes(pixels, field.escapes, 0, cols * rows, colors);
            context.putImageData(image, 0, 0);
            paintedRevision = field.revision;
            return true;
        }
        if (field.revision === paintedRevision) return false;

        // Each run of changed rows is coloured, and put, in one go.
        const revisions = field.rowRevisions;
        let row = 0;
        while (row < rows) {
            if (revisions[row] <= paintedRevision) {
                row++;
                continue;
            }
            const from = row;
            while (row < rows && revisions[row] > paintedRevision) row++;
            paintEscapes(pixels, field.escapes, from * cols, row * cols, colors);
            context.putImageData(image, 0, 0, 0, from, cols, row - from);
        }
        paintedRevision = field.revision;
        return true;
    }

    /**
     * Draws the picture where the scope's setting puts it. It draws nothing
     * when the picture has not changed and would land where it did last
     * frame.
     */
    function drawPicture(context: CanvasRenderingContext2D, field: EscapeGrid, isPainted: boolean): void {
        const cols = field.cols;
        const rows = field.rows;
        const now = bindings.setting();
        const taken = field.setting;
        if (!(now.width > 0) || !(taken.width > 0)) return;

        // How much wider a patch the picture was taken of than the scope
        // takes in now, which is how far the picture must be stretched.
        const stretch = taken.width / now.width;
        const unitsPerPixel = now.width / cols;
        const width = cols * stretch;
        const height = rows * stretch;
        const x = (cols - width) * 0.5 - (now.centreRe - taken.centreRe) / unitsPerPixel;
        const y = (rows - height) * 0.5 + (now.centreIm - taken.centreIm) / unitsPerPixel;
        if (!isPainted && x === drawnX && y === drawnY && width === drawnWidth) return;
        drawnX = x;
        drawnY = y;
        drawnWidth = width;

        if (x !== 0 || y !== 0 || width !== cols) {
            // Dragged or zoomed out, the picture no longer covers the canvas.
            context.fillStyle = BACKDROP;
            context.fillRect(0, 0, cols, rows);
        }
        // Stretched past its pixels, the picture shows them as blocks. Shrunk,
        // it is smoothed, because nearest neighbour would sparkle.
        context.imageSmoothingEnabled = stretch < 1;
        context.drawImage(picture, x, y, width, height);
    }

    /** Sizes the picture and its image data to a grid of `cols` by `rows` samples. */
    function resizePicture(context: CanvasRenderingContext2D, cols: number, rows: number): void {
        picture.width = cols;
        picture.height = rows;
        image = context.createImageData(cols, rows);
        pixels = new Int32Array(image.data.buffer);
        paintedCols = cols;
        paintedRows = rows;
    }

    /**
     * Reports how many samples the canvas is worth. That is its size in
     * device pixels, held to a limit. A phone's screen asks for three or four
     * samples per point of CSS, which costs far more than the extra sharpness
     * is worth.
     */
    function measure(): void {
        cssWidth = canvas.clientWidth;
        cssHeight = canvas.clientHeight;
        if (cssWidth <= 0 || cssHeight <= 0) return;
        const density = Math.min(window.devicePixelRatio || 1, MAX_SAMPLE_DENSITY);
        const allowed = Math.sqrt(MAX_SAMPLES / (cssWidth * cssHeight));
        const samplesPerPoint = Math.min(density, allowed);
        bindings.onResized?.(
            Math.max(1, Math.round(cssWidth * samplesPerPoint)),
            Math.max(1, Math.round(cssHeight * samplesPerPoint)),
        );
    }

    /** Turns a drag of the canvas into a move of the scope's centre, the other way. */
    function reportDrag(deltaX: number, deltaY: number): void {
        if (cssWidth <= 0) return;
        const unitsPerPoint = bindings.setting().width / cssWidth;
        // The picture follows the fingers, so the centre goes the other way.
        // The imaginary axis points up, and the screen's y axis points down.
        bindings.onDragged?.(-deltaX * unitsPerPoint, deltaY * unitsPerPoint);
    }

    /** Turns a zoom about a point of the canvas into a zoom about a point of the plane. */
    function reportZoom(factor: number, x: number, y: number): void {
        if (cssWidth <= 0 || cssHeight <= 0) return;
        const now = bindings.setting();
        const unitsPerPoint = now.width / cssWidth;
        bindings.onZoomed?.(
            factor,
            now.centreRe + (x - cssWidth * 0.5) * unitsPerPoint,
            now.centreIm - (y - cssHeight * 0.5) * unitsPerPoint,
        );
    }

    /** Hands the canvas, as it stands, to the browser to save as a PNG. */
    function savePhoto(): void {
        if (canvas.width <= 0 || canvas.height <= 0) return;
        const name = namePhoto(bindings.fractal(), bindings.setting(), bindings.magnification());
        canvas.toBlob((blob) => {
            // The browser gives nothing where it cannot make the picture.
            if (blob === null) return;
            if (photoUrl !== undefined) URL.revokeObjectURL(photoUrl);
            photoUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = photoUrl;
            link.download = name;
            link.click();
        }, 'image/png');
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What shows where the picture does not reach, as a CSS colour. */
const BACKDROP = `#${BACKDROP_COLOR.toString(16).padStart(6, '0')}`;

/** The file name for a photo of `fractal` at `setting`, saying which, where it is and how far in. */
function namePhoto(fractal: FractalKind, setting: ScopeSetting, zoom: number): string {
    const digits = countDigits(setting.width);
    const re = setting.centreRe.toFixed(digits);
    const im = setting.centreIm.toFixed(digits);
    const times = zoom.toExponential(1).replace('e+', 'e');
    return `${fractal}_re${re}_im${im}_zoom${times}.png`;
}
