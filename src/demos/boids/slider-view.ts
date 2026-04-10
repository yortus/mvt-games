import { Container, Graphics, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Scale mode for mapping slider position to value. */
export type SliderScaleMode = 'linear' | 'log';

/** Bindings for a draggable slider control. */
export interface SliderViewBindings {
    /** Display label shown above the slider. */
    getLabel(): string;
    /** Minimum value at the left edge of the track. */
    getMin(): number;
    /** Maximum value at the right edge of the track. */
    getMax(): number;
    /** Snap increment. The value is rounded to the nearest multiple. */
    getStep(): number;
    /** Current value of the slider. */
    getValue(): number;
    /** Whether the slider maps positions linearly or logarithmically. */
    getScaleMode(): SliderScaleMode;
    /** Optional override for the track width in pixels. */
    getWidth?(): number;
    /** Optional override for the track height in pixels. */
    getHeight?(): number;
    /** Called when the user drags the knob to a new value. */
    onValueChanged?(value: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a draggable slider view wired to the given bindings. */
export function createSliderView(bindings: SliderViewBindings): Container {
    const view = new Container();
    view.label = 'slider';

    const nameText = new Text({ text: '', resolution: TEXT_RESOLUTION, style: { fontFamily: 'monospace', fontSize: LABEL_SIZE, fill: 0xdddddd } });
    const valueText = new Text({ text: '', resolution: TEXT_RESOLUTION, style: { fontFamily: 'monospace', fontSize: LABEL_SIZE, fill: 0xdddddd } });
    const minText = new Text({ text: '', resolution: TEXT_RESOLUTION, style: { fontFamily: 'monospace', fontSize: SMALL_LABEL_SIZE, fill: 0x888888 } });
    const maxText = new Text({ text: '', resolution: TEXT_RESOLUTION, style: { fontFamily: 'monospace', fontSize: SMALL_LABEL_SIZE, fill: 0x888888 } });
    const track = new Graphics();
    const fill = new Graphics();
    const knob = new Graphics();

    // Hit area covers the full track for click-to-seek
    const hitArea = new Graphics();
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';

    view.addChild(track, fill, hitArea, knob, nameText, valueText, minText, maxText);

    // Interaction state
    let isDragging = false;
    let trackingPointerId = -1;

    hitArea.on('pointerdown', onPointerDown);
    hitArea.on('pointermove', onPointerMove);
    hitArea.on('pointerup', onPointerUp);
    hitArea.on('pointerupoutside', onPointerUp);

    view.onRender = refresh;
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const w = bindings.getWidth?.() ?? DEFAULT_WIDTH;
        const min = bindings.getMin();
        const max = bindings.getMax();
        const value = bindings.getValue();
        const mode = bindings.getScaleMode();

        // Label (top-left)
        nameText.text = bindings.getLabel();
        nameText.position.set(0, 0);

        // Value (top-right)
        valueText.text = formatValue(value, bindings.getStep());
        valueText.position.set(w - valueText.width, 0);

        // Track
        const trackY = LABEL_SIZE + TRACK_MARGIN_TOP;
        const trackLeft = KNOB_RADIUS;
        const trackRight = w - KNOB_RADIUS;
        const trackWidth = trackRight - trackLeft;

        track.clear();
        track.roundRect(trackLeft, trackY, trackWidth, TRACK_HEIGHT, TRACK_HEIGHT / 2)
            .fill({ color: 0x444444 });

        // Fill (from left to knob)
        const t = valueToT(value, min, max, mode);
        const knobX = trackLeft + t * trackWidth;

        fill.clear();
        if (t > 0) {
            fill.roundRect(trackLeft, trackY, (knobX - trackLeft), TRACK_HEIGHT, TRACK_HEIGHT / 2)
                .fill({ color: 0x6688cc });
        }

        // Knob
        knob.clear();
        knob.circle(knobX, trackY + TRACK_HEIGHT / 2, KNOB_RADIUS)
            .fill({ color: isDragging ? 0xaaccff : 0x88aadd });
        knob.circle(knobX, trackY + TRACK_HEIGHT / 2, KNOB_RADIUS)
            .stroke({ color: 0xffffff, width: 1.5 });

        // Hit area (invisible but interactive)
        hitArea.clear();
        hitArea.rect(0, trackY - KNOB_RADIUS, w, TRACK_HEIGHT + KNOB_RADIUS * 2)
            .fill({ color: 0x000000, alpha: 0.001 });

        // Min label (bottom-left)
        const bottomY = trackY + TRACK_HEIGHT + TRACK_MARGIN_BOTTOM;
        minText.text = formatValue(min, bindings.getStep());
        minText.position.set(trackLeft, bottomY);

        // Max label (bottom-right)
        maxText.text = formatValue(max, bindings.getStep());
        maxText.position.set(trackRight - maxText.width, bottomY);
    }

    // ---- Interaction -------------------------------------------------------

    function onPointerDown(e: { pointerId: number; getLocalPosition: (target: Container) => { x: number } }): void {
        isDragging = true;
        trackingPointerId = e.pointerId;
        applyPointerPosition(e);
    }

    function onPointerMove(e: { pointerId: number; getLocalPosition: (target: Container) => { x: number } }): void {
        if (!isDragging || e.pointerId !== trackingPointerId) return;
        applyPointerPosition(e);
    }

    function onPointerUp(e: { pointerId: number }): void {
        if (e.pointerId !== trackingPointerId) return;
        isDragging = false;
        trackingPointerId = -1;
    }

    function applyPointerPosition(e: { getLocalPosition: (target: Container) => { x: number } }): void {
        const w = bindings.getWidth?.() ?? DEFAULT_WIDTH;
        const trackLeft = KNOB_RADIUS;
        const trackRight = w - KNOB_RADIUS;
        const trackWidth = trackRight - trackLeft;

        const local = e.getLocalPosition(view);
        const rawT = Math.max(0, Math.min(1, (local.x - trackLeft) / trackWidth));

        const min = bindings.getMin();
        const max = bindings.getMax();
        const mode = bindings.getScaleMode();
        const step = bindings.getStep();

        let value = tToValue(rawT, min, max, mode);
        value = snapToStep(value, step, min, max);

        bindings.onValueChanged?.(value);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEXT_RESOLUTION = (typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis)
    ? globalThis.devicePixelRatio
    : 1;

const DEFAULT_WIDTH = 280;
const LABEL_SIZE = 12;
const SMALL_LABEL_SIZE = 10;
const TRACK_HEIGHT = 6;
const TRACK_MARGIN_TOP = 4;
const TRACK_MARGIN_BOTTOM = 4;
const KNOB_RADIUS = 8;

/**
 * Fraction of the track reserved for the zero snap zone on a log scale with
 * min=0.  Kept small so it barely shifts the equal-decade positions.
 */
const LOG_ZERO_T = 0.02;

function valueToT(value: number, min: number, max: number, mode: SliderScaleMode): number {
    if (mode === 'log') {
        // When min is 0 the track is divided into equal-width decades.
        // An implicit decade from 0.1 to 1 sits below the explicit range
        // (1 to max), so value=1 lands at 1/(numDecades+1) of the log region.
        if (min === 0) {
            if (value <= 0) return 0;
            const logMax = Math.log10(max);
            const fraction = Math.max(0, (Math.log10(value) + 1) / (logMax + 1));
            return LOG_ZERO_T + (1 - LOG_ZERO_T) * fraction;
        }
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        const logVal = Math.log10(Math.max(value, min));
        return (logVal - logMin) / (logMax - logMin);
    }
    return (value - min) / (max - min);
}

function tToValue(t: number, min: number, max: number, mode: SliderScaleMode): number {
    if (mode === 'log') {
        if (min === 0) {
            if (t <= LOG_ZERO_T) return 0;
            const logMax = Math.log10(max);
            const tNorm = (t - LOG_ZERO_T) / (1 - LOG_ZERO_T);
            return Math.pow(10, tNorm * (logMax + 1) - 1);
        }
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        return Math.pow(10, logMin + t * (logMax - logMin));
    }
    return min + t * (max - min);
}

function snapToStep(value: number, step: number, min: number, max: number): number {
    if (step <= 0) return Math.max(min, Math.min(max, value));
    const snapped = Math.round((value - min) / step) * step + min;
    return Math.max(min, Math.min(max, snapped));
}

function formatValue(value: number, step: number): string {
    if (step >= 1) return String(Math.round(value));
    const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}
