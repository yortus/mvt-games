import { type CellRun, PIXEL_HEIGHT, pixelTextRuns, pixelTextWidth } from './pixel-font';
import { svgElement } from './svg-element';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WordmarkViewBindings {
    /** What it spells, in the characters `PIXEL_FONT` has, and spaces. Fixed. */
    readonly text: string;
    /** What it says, for assistive technology. Fixed. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The arcade's name as a marquee, in the same pixel font as the cards'
 * titles (`PIXEL_FONT`), set bold, but dressed up: yellow, outlined in
 * black, and extruded down and to the right in orange, like the lettering
 * on an old arcade cabinet. Drawn as one SVG that scales with its height. It
 * does not change, so it has no update or refresh step.
 */
export function WordmarkView(bindings: WordmarkViewBindings): SVGSVGElement {
    const blocks = pixelTextRuns(bindings.text, PADDING, PADDING);
    const width = pixelTextWidth(bindings.text) + 2 * PADDING + DEPTH;
    const height = PIXEL_HEIGHT + 2 * PADDING + DEPTH;

    const svg = svgElement('svg', {
        'class': 'wordmark',
        'viewBox': `0 0 ${width} ${height}`,
        'role': 'img',
        'aria-label': bindings.label,
    });
    const defs = svgElement('defs', {});
    const face = svgElement('linearGradient', { id: 'wordmark-face', x1: '0', y1: `${PADDING}`, x2: '0', y2: `${PADDING + PIXEL_HEIGHT}`, gradientUnits: 'userSpaceOnUse' });
    for (const [offset, colour] of FACE_STOPS) face.append(svgElement('stop', { offset, 'stop-color': colour }));
    defs.append(face);
    svg.append(defs);

    // Back to front: the outline round the letters and their depth, the depth, then the faces.
    // Each layer's blocks overlap, and the next layer covers the strokes the blocks share
    const outline = svgElement('g', { 'fill': OUTLINE, 'stroke': OUTLINE, 'stroke-width': `${2 * OUTLINE_WIDTH}`, 'stroke-linejoin': 'round' });
    const depth = svgElement('g', { fill: DEPTH_COLOUR });
    const faces = svgElement('g', { fill: 'url(#wordmark-face)' });
    for (let step = DEPTH_STEPS; step >= 0; step--) {
        const shift = (DEPTH * step) / DEPTH_STEPS;
        for (const block of blocks) {
            outline.append(rect(block, shift));
            if (step > 0) depth.append(rect(block, shift));
        }
    }
    for (const block of blocks) faces.append(rect(block, 0));
    svg.append(outline, depth, faces);
    return svg;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Room round the letters for their outline, in cells. */
const PADDING = 0.6;
/** How far the letters are extruded, down and to the right, in cells, and in how many steps. */
const DEPTH = 0.9;
const DEPTH_STEPS = 6;
const OUTLINE_WIDTH = 0.42;
const ROW_OVERLAP = 0.04;

const OUTLINE = '#160d02';
const DEPTH_COLOUR = '#d4520f';
const FACE_STOPS: readonly (readonly [string, string])[] = [
    ['0', '#fff7b0'],
    ['0.45', '#ffd83d'],
    ['1', '#ffaa00'],
];

function rect(block: CellRun, shift: number): SVGRectElement {
    return svgElement('rect', {
        x: `${block.x + shift}`,
        y: `${block.y + shift}`,
        width: `${block.width}`,
        // A little over a cell, so rows overlap and no hairline shows between them when scaled
        height: `${1 + ROW_OVERLAP}`,
    });
}
