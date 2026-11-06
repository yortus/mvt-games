/** @jsxImportSource @mvtjs/html */
import { createComputed } from '@mvtjs/utils';
import {
    DEFAULT_RADIUS,
    MAX_MORPH_SPEED,
    MAX_RADIUS,
    MIN_RADIUS,
    SYMMETRIES,
} from '../data';
import { COLOR_MODES, type ColorMode } from './color-mode';
import { PALETTE_NAMES, type PaletteName } from './palette-name';
import { describeSwatch, PALETTES } from './palettes';
import { MAX_FLOW_SPEED } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TilingPanelViewBindings {
    /** The tiling's symmetry, one of `SYMMETRIES`. */
    symmetry: () => number;
    /** How far the grids are shifted, from 0 to 1. */
    shift: () => number;
    /** How far from the tiles to their grids the picture is, from 0 to 1. */
    gridReveal: () => number;
    /** How far the tiles have drawn back to their crossings, from 0 to 1. */
    drawBack: () => number;
    /** How far the window reaches, in tile edges. */
    radius: () => number;
    /** How far the window is turned, in radians. */
    rotation: () => number;
    /** The palette the tiles are coloured from. */
    palette: () => PaletteName;
    /** What decides each tile's colour. */
    colorMode: () => ColorMode;
    /** Where on the palette the colours start, from 0 to 1. */
    colorOffset: () => number;
    /** How fast the grids shift while the tiling drifts, in whole shifts per second. */
    morphSpeed: () => number;
    /** How fast the colours flow while the tiling drifts, in whole palettes per second. */
    flowSpeed: () => number;
    /** Whether the tiling is drifting. */
    isDrifting: () => boolean;
    /** The visitor slid the symmetry to `symmetry`. */
    onSymmetrySlid?: (symmetry: number) => void;
    /** The visitor slid the shift to `shift`. */
    onShiftSlid?: (shift: number) => void;
    /** The visitor slid the grids to `reveal`. */
    onGridRevealSlid?: (reveal: number) => void;
    /** The visitor slid the zoom to `radius`, in tile edges. */
    onRadiusSlid?: (radius: number) => void;
    /** The visitor slid the turn to `rotation`, in radians. */
    onRotationSlid?: (rotation: number) => void;
    /** The visitor chose the palette `palette`. */
    onPaletteChosen?: (palette: PaletteName) => void;
    /** The visitor chose the colour mode `colorMode`. */
    onColorModeChosen?: (colorMode: ColorMode) => void;
    /** The visitor slid the colour to `offset`. */
    onColorOffsetSlid?: (offset: number) => void;
    /** The visitor slid the morph to `speed`. */
    onMorphSpeedSlid?: (speed: number) => void;
    /** The visitor slid the flow to `speed`. */
    onFlowSpeedSlid?: (speed: number) => void;
    /** The visitor pressed Show grids, or Hide grids. */
    onGridsPressed?: () => void;
    /** The visitor pressed Start drift, or Pause drift. */
    onDriftPressed?: () => void;
    /** The visitor pressed Surprise me. */
    onSurprisePressed?: () => void;
    /** The visitor pressed Reset view. */
    onResetPressed?: () => void;
    /** The visitor pressed Save picture. */
    onPicturePressed?: () => void;
    /** The visitor pressed the panel's Hide button. */
    onHidePressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The panel beside the tiling: a slider for each of its settings, the
 * palettes and colour modes to choose from, and buttons that show the
 * grids, start and stop the drift, ask for a surprise, reset the view, and save a
 * picture.
 *
 * It only shows and reports. Whoever wires it up says what each control
 * does. Every slider follows what it is given, so a slider moves as the tiling
 * drifts, or as a key or a gesture changes what it shows. Some sliders speak
 * the visitor's words: the zoom slider moves evenly through each doubling of
 * the zoom, the turn is in degrees, and the speeds are shown as shares of
 * their fastest.
 */
export function TilingPanelView(bindings: TilingPanelViewBindings): Element {
    const symmetryText = createComputed({ watch: bindings.symmetry, compute: (symmetry) => `${symmetry}-fold` });
    const shiftText = createComputed({ watch: () => Math.round(bindings.shift() * 100), compute: formatPercent });
    const zoomText = createComputed({ watch: () => Math.round((DEFAULT_RADIUS / bindings.radius()) * 10), compute: formatZoom });
    const turnText = createComputed({ watch: () => Math.round(toDegrees(bindings.rotation())), compute: (degrees) => `${degrees}°` });
    const colorText = createComputed({ watch: () => Math.round(bindings.colorOffset() * 100), compute: formatPercent });
    const morphText = createComputed({ watch: () => Math.round((bindings.morphSpeed() / MAX_MORPH_SPEED) * 100), compute: formatPercent });
    const flowText = createComputed({ watch: () => Math.round((bindings.flowSpeed() / MAX_FLOW_SPEED) * 100), compute: formatPercent });
    const gridsText = createComputed({ watch: () => Math.round(bindings.gridReveal() * 100), compute: formatPercent });

    return (
        <aside class="tiling-panel" aria-label="Tiling controls">
            <header class="tiling-panel-head">
                <h2 class="tiling-panel-title" text="Penrose Tiling" />
                <button type="button" class="tiling-hide" aria-label="Hide the controls" title="Hide the controls (H)" onClick={() => bindings.onHidePressed?.()} />
            </header>

            <section class="tiling-group" aria-label="Tiles">
                <h3 class="tiling-group-title" text="Tiles" />
                <RangeView
                    id="tiling-symmetry"
                    label="Symmetry"
                    min={0}
                    max={SYMMETRIES.length - 1}
                    step={1}
                    value={() => SYMMETRIES.indexOf(bindings.symmetry())}
                    text={symmetryText}
                    onValueInput={(index) => bindings.onSymmetrySlid?.(SYMMETRIES[index])}
                />
                <RangeView
                    id="tiling-shift"
                    label="Shift"
                    min={0}
                    max={1}
                    step={0.001}
                    value={bindings.shift}
                    text={shiftText}
                    onValueInput={(shift) => bindings.onShiftSlid?.(shift)}
                />
                <RangeView
                    id="tiling-grids"
                    label="Grids"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bindings.gridReveal}
                    text={gridsText}
                    onValueInput={(reveal) => bindings.onGridRevealSlid?.(reveal)}
                />
                <button
                    type="button"
                    class="tiling-action"
                    text={() => (bindings.gridReveal() >= 0.5 ? 'Hide grids' : 'Show grids')}
                    onClick={() => bindings.onGridsPressed?.()}
                />
                <p class="tiling-hint" visible={() => bindings.drawBack() > 0} text="Each tile comes from a crossing of two lines. Tap one to see which." />
            </section>

            <section class="tiling-group" aria-label="View">
                <h3 class="tiling-group-title" text="View" />
                <RangeView
                    id="tiling-zoom"
                    label="Zoom"
                    min={0}
                    max={1}
                    step={0.001}
                    value={() => toZoomPosition(bindings.radius())}
                    text={zoomText}
                    onValueInput={(position) => bindings.onRadiusSlid?.(fromZoomPosition(position))}
                />
                <RangeView
                    id="tiling-turn"
                    label="Turn"
                    min={-180}
                    max={180}
                    step={1}
                    value={() => Math.round(toDegrees(bindings.rotation()))}
                    text={turnText}
                    onValueInput={(degrees) => bindings.onRotationSlid?.((degrees * Math.PI) / 180)}
                />
            </section>

            <section class="tiling-group" aria-label="Colours">
                <h3 class="tiling-group-title" text="Colours" />
                <div class="tiling-swatches" role="group" aria-label="Palette">
                    {PALETTE_NAMES.map((name) => (
                        <button
                            type="button"
                            class={() => (bindings.palette() === name ? 'tiling-swatch chosen' : 'tiling-swatch')}
                            style={`background: ${describeSwatch(name)}`}
                            title={PALETTES[name].label}
                            aria-label={PALETTES[name].label}
                            aria-pressed={() => (bindings.palette() === name ? 'true' : 'false')}
                            onClick={() => bindings.onPaletteChosen?.(name)}
                        />
                    ))}
                </div>
                <div class="tiling-modes" role="group" aria-label="Colour by">
                    {COLOR_MODES.map((mode) => (
                        <button
                            type="button"
                            class={() => (bindings.colorMode() === mode ? 'tiling-mode chosen' : 'tiling-mode')}
                            text={COLOR_MODE_LABELS[mode]}
                            aria-pressed={() => (bindings.colorMode() === mode ? 'true' : 'false')}
                            onClick={() => bindings.onColorModeChosen?.(mode)}
                        />
                    ))}
                </div>
                <RangeView
                    id="tiling-color"
                    label="Colour"
                    min={0}
                    max={1}
                    step={0.001}
                    value={bindings.colorOffset}
                    text={colorText}
                    onValueInput={(offset) => bindings.onColorOffsetSlid?.(offset)}
                />
            </section>

            <section class="tiling-group" aria-label="Drift">
                <h3 class="tiling-group-title" text="Drift" />
                <RangeView
                    id="tiling-morph"
                    label="Morph"
                    min={0}
                    max={MAX_MORPH_SPEED}
                    step={MAX_MORPH_SPEED / 100}
                    value={bindings.morphSpeed}
                    text={morphText}
                    onValueInput={(speed) => bindings.onMorphSpeedSlid?.(speed)}
                />
                <RangeView
                    id="tiling-flow"
                    label="Flow"
                    min={0}
                    max={MAX_FLOW_SPEED}
                    step={MAX_FLOW_SPEED / 100}
                    value={bindings.flowSpeed}
                    text={flowText}
                    onValueInput={(speed) => bindings.onFlowSpeedSlid?.(speed)}
                />
            </section>

            <div class="tiling-actions">
                <button
                    type="button"
                    class="tiling-action"
                    text={() => (bindings.isDrifting() ? 'Pause drift' : 'Start drift')}
                    aria-pressed={() => (bindings.isDrifting() ? 'true' : 'false')}
                    onClick={() => bindings.onDriftPressed?.()}
                />
                <button type="button" class="tiling-action" text="Surprise me" onClick={() => bindings.onSurprisePressed?.()} />
                <button type="button" class="tiling-action" text="Reset view" onClick={() => bindings.onResetPressed?.()} />
                <button type="button" class="tiling-action" text="Save picture" onClick={() => bindings.onPicturePressed?.()} />
            </div>

            <p class="tiling-hint tiling-gestures" text="Drag to move. Pinch, scroll or double tap to zoom, and twist two fingers to turn." />
            <p
                class="tiling-hint tiling-keys"
                text="Keys: arrows move, + and - zoom, Q and E turn, [ and ] change the symmetry, , and . shift, Space drifts, C palette, V colour by, X surprise, G grids, R resets the view, H hides this panel, P saves a picture."
            />
        </aside>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What each colour mode's button says. */
const COLOR_MODE_LABELS: Readonly<Record<ColorMode, string>> = {
    shapes: 'Shape',
    directions: 'Direction',
    rings: 'Rings',
    spiral: 'Spiral',
};

function formatPercent(percent: number): string {
    return `${percent}%`;
}

/** The zoom, given in tenths, as the slider shows it, such as "1.5x". */
function formatZoom(tenths: number): string {
    return `${(tenths / 10).toFixed(1)}×`;
}

function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

/** Where the zoom slider sits for `radius`: 0 all the way out, 1 all the way in, with each doubling of the zoom the same distance apart. */
function toZoomPosition(radius: number): number {
    return Math.log(MAX_RADIUS / radius) / Math.log(MAX_RADIUS / MIN_RADIUS);
}

/** The radius for the zoom slider at `position`. */
function fromZoomPosition(position: number): number {
    return MAX_RADIUS * (MIN_RADIUS / MAX_RADIUS) ** position;
}

interface RangeViewBindings {
    readonly id: string;
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly value: () => number;
    /** The value as the panel shows it, beside the slider. */
    readonly text: () => string;
    /** The visitor moved the slider to `value`. */
    readonly onValueInput: (value: number) => void;
}

/** A labelled slider, with the value it shows as text beside it. */
function RangeView(bindings: RangeViewBindings): Element {
    const { id, min, max } = bindings;
    // The share of the track coloured, in half percents, so the style is
    // written only when that changes, rather than every frame of a drift.
    let shownHalfPercent = Number.NaN;
    return (
        <div class="tiling-range">
            <label for={id} text={bindings.label} />
            <input
                id={id}
                type="range"
                min={String(min)}
                max={String(max)}
                step={String(bindings.step)}
                valueAsNumber={bindings.value}
                onInput={(event) => {
                    bindings.onValueInput((event.currentTarget as HTMLInputElement).valueAsNumber);
                }}
                onRefresh={showFill}
            />
            <span class="tiling-range-value" text={bindings.text} />
        </div>
    );

    /** Sets `--fill` to the thumb's place, which the stylesheet colours the track up to. */
    function showFill(slider: HTMLInputElement): void {
        const halfPercent = Math.round(((bindings.value() - min) / (max - min)) * 200);
        if (halfPercent === shownHalfPercent) return;
        shownHalfPercent = halfPercent;
        slider.style.setProperty('--fill', `${halfPercent / 2}%`);
    }
}
