import type { SymbolKind } from '../../data';
import { SYMBOL_TONES } from './palette';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * A symbol's picture, as SVG markup on a 100 x 100 view box with a clear
 * background. Written in code rather than kept as files, so every colour
 * comes from the palette and a tweak is one edit.
 */
export function svgFor(kind: SymbolKind): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${BODIES[kind]}</svg>`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BODIES: { readonly [K in SymbolKind]: string } = {
    pic1: melon(),
    pic2: grapes(),
    pic3: cherries(),
    pic4: orange(),
    pic5: lemon(),
    pic6: blueberries(),
    wild: wild(),
};

/** A slice, rind round the bottom, tipped a little. */
function melon(): string {
    const { rind, flesh, seed } = SYMBOL_TONES.pic1;
    const seeds = [[34, 41, -25], [50, 46, 0], [66, 41, 25], [42, 56, -12], [58, 56, 12]]
        .map(([x, y, angle]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4.4" transform="rotate(${angle} ${x} ${y})" fill="${seed}"/>`)
        .join('');
    return `<g transform="rotate(-12 50 50)">`
        + `<path d="M10 32 A40 40 0 0 0 90 32 Z" fill="${rind}"/>`
        + `<path d="M17 32 A33 33 0 0 0 83 32 Z" fill="${flesh}"/>`
        + `${seeds}</g>`;
}

/** A bunch of four, three, two and one, under a leaf. */
function grapes(): string {
    const { grape, shade, leaf } = SYMBOL_TONES.pic2;
    const rows = [[21.5, 40.5, 59.5, 78.5], [31, 50, 69], [40.5, 59.5], [50]];
    let body = `<rect x="48" y="13" width="4" height="16" rx="2" fill="${leaf}"/>`
        + `<ellipse cx="65" cy="18" rx="13" ry="6.5" transform="rotate(-25 65 18)" fill="${leaf}"/>`;
    rows.forEach((xs, row) => {
        const y = 36 + row * 16;
        for (const x of xs) body += shadedCircle(x, y, 9.5, grape, shade);
    });
    return body;
}

/** A pair on stems that meet under a leaf. */
function cherries(): string {
    const { cherry, shade, stem } = SYMBOL_TONES.pic3;
    return `<path d="M32 52 Q38 28 58 14 M66 48 Q62 30 58 14" stroke="${stem}" stroke-width="4" stroke-linecap="round" fill="none"/>`
        + `<ellipse cx="70" cy="15" rx="12" ry="5.5" transform="rotate(-20 70 15)" fill="${stem}"/>`
        + shadedCircle(32, 68, 17, cherry, shade)
        + shadedCircle(66, 64, 17, cherry, shade);
}

/** Round, with a shine, a few dimples and a leaf. */
function orange(): string {
    const { peel, highlight, leaf } = SYMBOL_TONES.pic4;
    const dimples = [[62, 62], [55, 75], [71, 49], [68, 72]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${highlight}"/>`)
        .join('');
    return `<rect x="48" y="16" width="4" height="9" rx="2" fill="${leaf}"/>`
        + `<circle cx="50" cy="57" r="34" fill="${peel}"/>`
        + `<ellipse cx="61" cy="20" rx="12" ry="6" transform="rotate(-30 61 20)" fill="${leaf}"/>`
        + `<ellipse cx="37" cy="44" rx="9" ry="5.5" transform="rotate(-40 37 44)" fill="${highlight}"/>`
        + dimples;
}

/** An oval with a nub at each end, tipped up. */
function lemon(): string {
    const { peel, highlight, tip } = SYMBOL_TONES.pic5;
    return `<g transform="rotate(-25 50 52)">`
        + `<ellipse cx="11" cy="52" rx="7" ry="5" fill="${tip}"/>`
        + `<ellipse cx="89" cy="52" rx="7" ry="5" fill="${tip}"/>`
        + `<ellipse cx="50" cy="52" rx="37" ry="27" fill="${peel}"/>`
        + `<ellipse cx="40" cy="41" rx="14" ry="5" fill="${highlight}"/>`
        + `</g>`;
}

/** Three berries, each with a shine and a star-shaped crown. */
function blueberries(): string {
    const { berry, crown, highlight } = SYMBOL_TONES.pic6;
    return [[50, 37, 18], [31, 63, 19], [69, 63, 19]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${berry}"/>`
            + `<circle cx="${x - 8}" cy="${y - 7}" r="4.5" fill="${highlight}"/>`
            + `<polygon points="${starPoints(x + 5, y - 4, 6, 2.6)}" fill="${crown}"/>`)
        .join('');
}

/**
 * WILD, in big white letters with a heavy dark outline, on a rounded tile of
 * rainbow stripes in the fruits' own colours: the symbol that stands in for
 * every fruit wears all of them. The one symbol drawn in more than three
 * tones, on purpose. White is the one bright colour that stands out on every
 * stripe.
 */
function wild(): string {
    const { letter, outline } = SYMBOL_TONES.wild;
    const bands = [
        SYMBOL_TONES.pic3.cherry, SYMBOL_TONES.pic4.peel, SYMBOL_TONES.pic5.peel,
        SYMBOL_TONES.pic2.leaf, SYMBOL_TONES.pic6.berry, SYMBOL_TONES.pic2.grape,
    ];
    // Narrow enough, on the 100-unit view box, that all six show across the tile
    const stripeWidth = 15;
    let stripes = '';
    for (let i = -4; i < 12; i++) {
        const color = bands[((i % bands.length) + bands.length) % bands.length];
        stripes += `<rect x="${-20 + i * stripeWidth}" y="-40" width="${stripeWidth + 0.5}" height="180" fill="${color}" transform="rotate(35 50 50)"/>`;
    }
    return '<defs><clipPath id="tile"><rect x="6" y="6" width="88" height="88" rx="18"/></clipPath></defs>'
        + `<g clip-path="url(#tile)">${stripes}</g>`
        + `<text x="50" y="60" text-anchor="middle" font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif" `
        + `font-size="26" font-weight="900" fill="${letter}" stroke="${outline}" stroke-width="6.5" stroke-linejoin="round" `
        + 'paint-order="stroke">WILD</text>';
}

/** A circle in its shade, with a smaller one in its colour up and to the left: a flat, two-tone ball. */
function shadedCircle(x: number, y: number, r: number, color: string, shade: string): string {
    const inset = r * 0.15;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${shade}"/>`
        + `<circle cx="${x - inset}" cy="${y - inset}" r="${r - inset * 1.1}" fill="${color}"/>`;
}

/** The points of a five-pointed star, first point up. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
    const points: string[] = [];
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return points.join(' ');
}
