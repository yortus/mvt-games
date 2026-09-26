import { DOMAdapter, type ICanvas } from 'pixi.js';

// ---------------------------------------------------------------------------
// Text measurement under Node, for the measured file of a suite
// ---------------------------------------------------------------------------

/** Estimated width of one character, as a share of the font size. */
const CHARACTER_WIDTH = 0.6;

/**
 * Lets Pixi measure text under Node, which has no canvas. Pixi measures a
 * `Text` when something reads its size, such as a view laying out labels by
 * their width. Call this before starting a game or demo that does.
 *
 * Widths are estimated from the font size rather than measured, so layout
 * that depends on them is approximate, and measuring costs less than it does
 * in a browser. Like the stubbed textures (see the driver), this changes what
 * would be drawn, not the model or the scene passes.
 */
export function stubTextMeasurement(): void {
    DOMAdapter.set({
        ...DOMAdapter.get(),
        createCanvas: createMeasuringCanvas,
        // Pixi checks this prototype for letter-spacing support; this one has none
        getCanvasRenderingContext2D: () => ({ prototype: {} }) as unknown as { prototype: CanvasRenderingContext2D },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A canvas whose 2D context has only what Pixi's text measurement uses. */
function createMeasuringCanvas(): ICanvas {
    let fontSize = 16;
    const context = {
        get font() {
            return `${fontSize}px sans-serif`;
        },
        set font(value: string) {
            const match = /(\d+(?:\.\d+)?)px/.exec(value);
            fontSize = match === null ? 16 : Number(match[1]);
        },
        measureText: (text: string) => {
            const width = text.length * fontSize * CHARACTER_WIDTH;
            return {
                width,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: width,
                actualBoundingBoxAscent: fontSize * 0.8,
                actualBoundingBoxDescent: fontSize * 0.2,
            };
        },
    };
    return { width: 10, height: 10, getContext: () => context } as unknown as ICanvas;
}
