import { setRefresh, type ValueOrGetter } from '@mvtjs/html';
import { PIXEL_HEIGHT, pixelTextRuns, pixelTextWidth } from './pixel-font';
import { svgElement } from './svg-element';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a line of pixel text spells, and what it says to assistive technology. */
export interface PixelTextViewBindings {
    /** What it spells: capitals, digits, full stops and spaces (anything else reads as a space). */
    readonly text: ValueOrGetter<string>;
    /** What it says, for assistive technology. Defaults to the text. */
    readonly label?: ValueOrGetter<string>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A line of text in the arcade's pixel font (`PIXEL_FONT`), set bold. Drawn
 * as one SVG, in the text's colour (`currentColor`), that scales with its
 * box and keeps its shape: its stylesheet sets how tall it is, and how wide
 * it may grow. Text that does not change is drawn once, with no refresh
 * step; text that does is drawn again only when it changes.
 */
export function PixelTextView(bindings: PixelTextViewBindings): SVGSVGElement {
    const svg = svgElement('svg', {
        'class': 'pixel-text',
        'preserveAspectRatio': 'xMidYMid meet',
        'shape-rendering': 'crispEdges',
        'fill': 'currentColor',
        'role': 'img',
    });
    let drawnText: string | undefined;
    let drawnLabel: string | undefined;
    refresh();
    if (typeof bindings.text === 'function' || typeof bindings.label === 'function') setRefresh(svg, refresh);
    return svg;

    function refresh(): void {
        const text = readValue(bindings.text);
        if (text !== drawnText) draw(text);
        const label = bindings.label === undefined ? text : readValue(bindings.label);
        if (label !== drawnLabel) {
            drawnLabel = label;
            svg.setAttribute('aria-label', label);
        }
    }

    function draw(text: string): void {
        drawnText = text;
        svg.setAttribute('viewBox', `0 0 ${pixelTextWidth(text)} ${PIXEL_HEIGHT}`);
        svg.replaceChildren();
        for (const run of pixelTextRuns(text, 0, 0)) {
            svg.append(svgElement('rect', { x: `${run.x}`, y: `${run.y}`, width: `${run.width}`, height: '1' }));
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function readValue(value: ValueOrGetter<string>): string {
    return typeof value === 'function' ? value() : value;
}
