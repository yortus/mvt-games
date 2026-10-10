/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';
import { FRACTAL_KINDS, type FractalKind, type PaletteName } from '../data';
import type { EscapeGrid, PlaneRegion } from '../models';
import { FRACTAL_LABELS } from './fractal-labels';
import { MinimapView } from './minimap-view';
import { PALETTES } from './palettes';
import { createFixedText, countDigits, formatZoom } from './readouts';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SidePanelViewBindings {
    /** The fractal being explored. */
    fractal: () => FractalKind;
    /** The region being looked at: where the readouts come from, and the minimap's mark. */
    region: () => PlaneRegion;
    /** How much the region magnifies the fractal's home view. */
    zoom: () => number;
    /** The whole fractal at a glance, for the minimap. */
    overview: () => EscapeGrid;
    /** The shape of the image, as its width over its height. */
    aspect: () => number;
    /** How many iterations each sample of the image now shown gets. */
    maxIterations: () => number;
    /** How much of the image is final, from 0 to 1. */
    progress: () => number;
    /** The colours the image is drawn in. */
    palette: () => PaletteName;
    /** Whether a photo has been asked for, and waits for the image to be finished. */
    isPhotoPending: () => boolean;
    /** The visitor chose the fractal `fractal`. */
    onFractalChosen?: (fractal: FractalKind) => void;
    /** The visitor chose the palette `palette`. */
    onPaletteChosen?: (palette: PaletteName) => void;
    /** The visitor pressed Photo. */
    onPhotoPressed?: () => void;
    /** The visitor pressed Reset. */
    onResetPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The panel beside the image. It holds the fractals to choose from, the map,
 * where the view is and how far in, the palettes to choose from, and the
 * buttons that save a photo and go back to the whole fractal.
 *
 * The coordinates are shown to as many places as the view can tell apart,
 * which grows as the view narrows. Each is turned into text only when it
 * changes, so a still view builds no strings at all.
 */
export function SidePanelView(bindings: SidePanelViewBindings): Element {
    const realText = createFixedText();
    const imaginaryText = createFixedText();
    const zoomText = memoiseLast(formatZoom);
    const iterationsText = memoiseLast((iterations: number) => String(iterations));
    const progressText = memoiseLast((percent: number) => (percent >= 100 ? 'Sharp' : `Sharpening ${percent}%`));

    return (
        <aside class="scope-panel" aria-label="Explorer panel">
            <label class="scope-fractal">
                <span class="scope-group-title" text="Fractal" />
                <select class="scope-fractal-select" value={bindings.fractal} onInput={chooseFractal}>
                    {FRACTAL_KINDS.map((kind) => <option value={kind} text={FRACTAL_LABELS[kind]} />)}
                </select>
            </label>

            <div class="scope-map">
                {MinimapView({
                    overview: bindings.overview,
                    region: bindings.region,
                    aspect: bindings.aspect,
                    palette: bindings.palette,
                })}
            </div>

            <dl class="scope-readout">
                <ReadingView label="Real" value={() => realText(bindings.region().centerRe, places())} />
                <ReadingView label="Imaginary" value={() => imaginaryText(bindings.region().centerIm, places())} />
                <ReadingView label="Zoom" value={() => zoomText(bindings.zoom())} />
                <ReadingView label="Detail" value={() => iterationsText(bindings.maxIterations())} />
            </dl>

            <div class="scope-sharpness">
                <progress class="scope-progress" value={bindings.progress} max={1} />
                <span class="scope-sharpness-text" text={() => progressText(Math.round(bindings.progress() * 100))} />
            </div>

            <section class="scope-group" aria-label="Palette">
                <h3 class="scope-group-title" text="Palette" />
                <div class="scope-swatches">
                    {PALETTES.map((palette) => (
                        <button
                            type="button"
                            class={() => (bindings.palette() === palette.name ? 'scope-swatch chosen' : 'scope-swatch')}
                            style={`background: ${palette.swatch}`}
                            title={palette.label}
                            aria-label={palette.label}
                            aria-pressed={() => bindings.palette() === palette.name}
                            onClick={() => bindings.onPaletteChosen?.(palette.name)}
                        />
                    ))}
                </div>
            </section>

            <div class="scope-actions">
                <button
                    type="button"
                    class="scope-action"
                    text={() => (bindings.isPhotoPending() ? 'Sharpening...' : 'Photo')}
                    onClick={() => bindings.onPhotoPressed?.()}
                />
                <button type="button" class="scope-action" text="Reset" onClick={() => bindings.onResetPressed?.()} />
            </div>

            <p
                class="scope-hint"
                text="Drag to move. Pinch, scroll or double tap to zoom in. Photo saves the view once it is sharp."
            />
        </aside>
    );

    /** How many decimal places the coordinates deserve at this depth. */
    function places(): number {
        return countDigits(bindings.region().span);
    }

    /** Reports the fractal the visitor picked from the list. */
    function chooseFractal(event: Event): void {
        const value = (event.currentTarget as HTMLSelectElement).value;
        for (let i = 0; i < FRACTAL_KINDS.length; i++) {
            if (FRACTAL_KINDS[i] === value) bindings.onFractalChosen?.(FRACTAL_KINDS[i]);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ReadingViewBindings {
    readonly label: string;
    readonly value: () => string;
}

/** One line of the readout: what it is, and what it says. */
function ReadingView(bindings: ReadingViewBindings): Element {
    return (
        <div class="scope-reading">
            <dt class="scope-reading-label" text={bindings.label} />
            <dd class="scope-reading-value" text={bindings.value} />
        </div>
    );
}
