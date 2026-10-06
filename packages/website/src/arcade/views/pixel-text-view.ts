import { PIXEL_HEIGHT, pixelTextRuns, pixelTextWidth } from './pixel-font';
import { svgElement } from './svg-element';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PixelTextViewBindings {
    /** What it spells: capitals, digits and spaces (anything else reads as a space). Fixed. */
    readonly text: string;
    /** What it says, for assistive technology. Fixed. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A line of text in the arcade's pixel font (`PIXEL_FONT`), set bold. Drawn
 * as one SVG, in the text's colour (`currentColor`), that scales with its
 * box and keeps its shape: its stylesheet sets how tall it is, and how wide
 * it may grow. It does not change, so it has no update or refresh step.
 */
export function PixelTextView(bindings: PixelTextViewBindings): SVGSVGElement {
    const svg = svgElement('svg', {
        'class': 'pixel-text',
        'viewBox': `0 0 ${pixelTextWidth(bindings.text)} ${PIXEL_HEIGHT}`,
        'preserveAspectRatio': 'xMidYMid meet',
        'shape-rendering': 'crispEdges',
        'fill': 'currentColor',
        'role': 'img',
        'aria-label': bindings.label,
    });
    for (const run of pixelTextRuns(bindings.text, 0, 0)) {
        svg.append(svgElement('rect', { x: `${run.x}`, y: `${run.y}`, width: `${run.width}`, height: '1' }));
    }
    return svg;
}
