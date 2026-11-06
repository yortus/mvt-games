/** @jsxImportSource @mvtjs/html */
import { createComputed } from '@mvtjs/utils';
import { FRACTAL_KINDS, type FractalKind, type ScopeSetting } from '../data';
import type { PaletteName } from './palette-name';
import type { EscapeGrid } from './picture';
import { FRACTAL_LABELS } from './fractal-labels';
import { MinimapView } from './minimap-view';
import { PALETTES } from './palettes';
import { createFixedText, countDigits, formatZoom } from './readouts';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SidePanelViewBindings {
    /** Whether the panel shows. */
    isShown: () => boolean;
    /** The fractal being explored. */
    fractal: () => FractalKind;
    /** The scope's setting now: where the readouts come from, and the minimap's mark. */
    setting: () => ScopeSetting;
    /** How strongly the scope magnifies, shown as its zoom. */
    magnification: () => number;
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
    /** The visitor pressed Hide. */
    onHidePressed?: () => void;
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
    const { progress } = bindings;
    const realText = createFixedText();
    const imaginaryText = createFixedText();
    const zoomText = createComputed({ watch: bindings.magnification, compute: formatZoom });
    const iterationsText = createComputed({ watch: bindings.maxIterations, compute: String });
    const progressText = createComputed({ watch: () => Math.round(progress() * 100), compute: describeProgress });
    // Whether the list was last worked with the mouse or a finger, not the keyboard.
    let isListPointed = false;

    return (
        <aside class="scope-panel" aria-label="Explorer panel" visible={bindings.isShown}>
            <label class="scope-fractal">
                <span class="scope-group-title" text="Fractal" />
                <select
                    class="scope-fractal-select"
                    value={bindings.fractal}
                    onInput={chooseFractal}
                    onPointerDown={() => { isListPointed = true; }}
                    onKeyDown={() => { isListPointed = false; }}
                >
                    {FRACTAL_KINDS.map((kind) => <option value={kind} text={FRACTAL_LABELS[kind]} />)}
                </select>
            </label>

            <div class="scope-map">
                <MinimapView
                    overview={bindings.overview}
                    setting={bindings.setting}
                    aspect={bindings.aspect}
                    palette={bindings.palette}
                />
            </div>

            <dl class="scope-readout">
                <ReadingView label="Real" value={() => realText(bindings.setting().centreRe, places())} />
                <ReadingView label="Imaginary" value={() => imaginaryText(bindings.setting().centreIm, places())} />
                {/* The panel speaks the visitor's words, so the scope's magnification is its zoom */}
                <ReadingView label="Zoom" value={zoomText} />
                <ReadingView label="Detail" value={iterationsText} />
            </dl>

            <div class="scope-sharpness">
                <progress class="scope-progress" value={progress} max={1} />
                <span class="scope-sharpness-text" text={progressText} />
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
                <button
                    type="button"
                    class="scope-action"
                    text="Hide"
                    title="Hide the controls (H)"
                    onClick={() => bindings.onHidePressed?.()}
                />
            </div>

            <p
                class="scope-hint"
                text="Drag to move. Pinch, scroll or double tap to zoom in. Photo saves the view once it is sharp."
            />
            <p
                class="scope-hint scope-keys"
                text="Keys: arrows move, + and - zoom, [ and ] change the fractal, C palette, X surprise, R resets the view, H hides this panel, P saves a photo."
            />
        </aside>
    );

    /** How many decimal places the coordinates deserve at this depth. */
    function places(): number {
        return countDigits(bindings.setting().width);
    }

    /**
     * Reports the fractal the visitor picked from the list. A list with the
     * focus keeps every key for itself, so one picked with the mouse lets the
     * focus go, and the keys work the scope again. One being worked from the
     * keyboard keeps it, so that its arrows can go on through the fractals.
     * The browser can't tell us which it was: `:focus-visible` holds for a
     * list however it got the focus.
     */
    function chooseFractal(event: Event): void {
        const select = event.currentTarget as HTMLSelectElement;
        const value = select.value;
        if (isListPointed) select.blur();
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

/** How far the picture has sharpened, from a percentage. */
function describeProgress(percent: number): string {
    return percent >= 100 ? 'Sharp' : `Sharpening ${percent}%`;
}
