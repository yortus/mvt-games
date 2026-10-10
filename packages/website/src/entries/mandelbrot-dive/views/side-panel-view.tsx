/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';
import { HOME_SPAN, type PaletteName } from '../data';
import type { EscapeGrid, PlaneRegion } from '../models';
import { MinimapView } from './minimap-view';
import { PALETTES } from './palettes';
import { createFixedText, countDigits, formatZoom } from './readouts';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SidePanelViewBindings {
    /** The region being looked at: where the readouts come from, and the minimap's mark. */
    region: () => PlaneRegion;
    /** The whole set at a glance, for the minimap. */
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
 * The panel beside the image. It holds the map, where the view is and how
 * far in, the palettes to choose from, and the buttons that save a photo and
 * go back to the whole set.
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
        <aside class="dive-panel" aria-label="Explorer panel">
            <div class="dive-map">
                {MinimapView({
                    overview: bindings.overview,
                    region: bindings.region,
                    aspect: bindings.aspect,
                    palette: bindings.palette,
                })}
            </div>

            <dl class="dive-readout">
                <ReadingView label="Real" value={() => realText(bindings.region().centerRe, places())} />
                <ReadingView label="Imaginary" value={() => imaginaryText(bindings.region().centerIm, places())} />
                <ReadingView label="Zoom" value={() => zoomText(zoom())} />
                <ReadingView label="Detail" value={() => iterationsText(bindings.maxIterations())} />
            </dl>

            <div class="dive-sharpness">
                <progress class="dive-progress" value={bindings.progress} max={1} />
                <span class="dive-sharpness-text" text={() => progressText(Math.round(bindings.progress() * 100))} />
            </div>

            <section class="dive-group" aria-label="Palette">
                <h3 class="dive-group-title" text="Palette" />
                <div class="dive-swatches">
                    {PALETTES.map((palette) => (
                        <button
                            type="button"
                            class={() => (bindings.palette() === palette.name ? 'dive-swatch chosen' : 'dive-swatch')}
                            style={`background: ${palette.swatch}`}
                            title={palette.label}
                            aria-label={palette.label}
                            aria-pressed={() => bindings.palette() === palette.name}
                            onClick={() => bindings.onPaletteChosen?.(palette.name)}
                        />
                    ))}
                </div>
            </section>

            <div class="dive-actions">
                <button
                    type="button"
                    class="dive-action"
                    text={() => (bindings.isPhotoPending() ? 'Sharpening...' : 'Photo')}
                    onClick={() => bindings.onPhotoPressed?.()}
                />
                <button type="button" class="dive-action" text="Reset" onClick={() => bindings.onResetPressed?.()} />
            </div>

            <p
                class="dive-hint"
                text="Drag to move. Pinch, scroll or double tap to zoom in. Photo saves the view once it is sharp."
            />
        </aside>
    );

    /** How many decimal places the coordinates deserve at this depth. */
    function places(): number {
        return countDigits(bindings.region().span);
    }

    function zoom(): number {
        return HOME_SPAN / bindings.region().span;
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
        <div class="dive-reading">
            <dt class="dive-reading-label" text={bindings.label} />
            <dd class="dive-reading-value" text={bindings.value} />
        </div>
    );
}
