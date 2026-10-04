/**
 * Generate the flat vector-style cactus PNGs for Kwazy Cactii.
 *
 * Run:  npx tsx scripts/generate-kwazy-cactii-textures.ts
 *
 * Each cactus is a list of layers, drawn in order. A layer is a shape given
 * by a signed distance function (negative inside), with a dark outline round
 * its edge, a fill (usually two-toned, light on the left and dark on the
 * right), and marks drawn inside it (rib lines, flecks, spines). Rendering
 * from distances gives smooth edges without a vector library. The designs
 * are drawn from the real plants each piece is named after.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'kwazy-cactii', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

const WIDTH = 200;
const HEIGHT = 280;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

const OUTLINE: Rgb = [48, 48, 48];
const GREEN_LIGHT: Rgb = [132, 192, 96];
const GREEN_MID: Rgb = [100, 144, 64];
const GREEN_DARK: Rgb = [68, 104, 60];
const LIME: Rgb = [144, 196, 36];
const LIME_DARK: Rgb = [100, 140, 84];
const SAGE_LIGHT: Rgb = [147, 173, 128];
const SAGE_DARK: Rgb = [104, 136, 92];
const PINK_LIGHT: Rgb = [240, 98, 132];
const PINK_DARK: Rgb = [198, 58, 98];
const POT_LIGHT: Rgb = [180, 140, 108];
const POT_DARK: Rgb = [140, 100, 76];
const STONE_LIGHT: Rgb = [170, 166, 156];
const STONE_DARK: Rgb = [135, 130, 122];
const YELLOW: Rgb = [248, 236, 24];
const ORANGE: Rgb = [240, 172, 12];
const RED: Rgb = [232, 64, 44];
const MAGENTA: Rgb = [200, 50, 122];
const WHITE: Rgb = [246, 242, 232];
const CREAM: Rgb = [236, 232, 196];
const FLECK: Rgb = [238, 240, 226];
const SPINE: Rgb = [192, 57, 43];

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/** Signed distance from a point to a shape's edge: negative inside. */
type Sdf = (x: number, y: number) => number;

/** The fill colour at a point. */
type Paint = (x: number, y: number) => Rgb;

interface Mark {
    shape: Sdf;
    color: Rgb;
}

interface Layer {
    shape: Sdf;
    paint: Paint;
    /** Width of the dark band just inside the shape's edge. */
    outline: number;
    /** Drawn over the fill, and only inside it. */
    marks: readonly Mark[];
}

const OUTLINE_WIDTH = 4;
const SMALL_OUTLINE_WIDTH = 3;
const LINE_WIDTH = 3;

function layer(shape: Sdf, paint: Paint, marks: readonly Mark[] = [], outline = OUTLINE_WIDTH): Layer {
    return { shape, paint, outline, marks };
}

// ---------------------------------------------------------------------------
// Cacti
// ---------------------------------------------------------------------------

/** Bishop's cap: a low, ribbed, white-flecked dome with a yellow crown flower, in a shallow bowl. */
function astrophytum(): Layer[] {
    const dome = ellipse(100, 202, 78, 76);
    return [
        layer(
            intersect(dome, (_x, y) => y - 216),
            twoTone(100, SAGE_LIGHT, SAGE_DARK),
            [
                { shape: ring(ellipse(100, 202, 42, 76), LINE_WIDTH), color: OUTLINE },
                { shape: vline(100, LINE_WIDTH), color: OUTLINE },
                ...flecks(dome, 46, 7),
            ],
        ),
        ...flower({ cx: 100, cy: 126, r: 24, petals: 7, color: YELLOW, center: ORANGE }),
        layer(roundPoly([[36, 218], [164, 218], [154, 262], [46, 262]], 4), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
        layer(roundRect(18, 200, 182, 220, 5), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
    ];
}

/** Fairy-castle cactus: three fluted columns of different heights, a white night flower, in a tall planter. */
function cereus(): Layer[] {
    return [
        column(44, 96, 84, 21),
        column(118, 126, 152, 18),
        column(78, 26, 124, 24),
        ...flower({ cx: 160, cy: 142, r: 28, petals: 7, color: WHITE, center: YELLOW, angle: 10 }),
        layer(roundRect(38, 214, 162, 268, 6), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
        layer(roundRect(30, 202, 170, 220, 4), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
    ];

    function column(x0: number, top: number, x1: number, r: number): Layer {
        const mid = (x0 + x1) / 2;
        const flute = (x1 - x0) / 4;
        return layer(roundRect(x0, top, x1, 240, r), twoTone(mid, GREEN_LIGHT, GREEN_MID), [
            { shape: vline(mid, LINE_WIDTH), color: OUTLINE },
            { shape: vline(mid - flute, 2), color: GREEN_DARK },
            { shape: vline(mid + flute, 2), color: GREEN_DARK },
        ]);
    }
}

/** Moon cactus (grafted Gymnocalycium): a bright pink ball and two pups on a slim green stem, in a flowerpot. */
function gymnocalycium(): Layer[] {
    const ball = circle(100, 100, 52);
    return [
        layer(roundRect(84, 140, 116, 240, 9), twoTone(100, GREEN_LIGHT, GREEN_MID), [
            { shape: vline(100, LINE_WIDTH), color: OUTLINE },
        ]),
        pup(46, 128, 17),
        pup(156, 78, 15),
        layer(ball, twoTone(100, PINK_LIGHT, PINK_DARK), [
            { shape: ring(ellipse(100, 100, 30, 52), LINE_WIDTH), color: OUTLINE },
            { shape: vline(100, LINE_WIDTH), color: OUTLINE },
            ...flecks(ball, 28, 11, 1.6),
        ]),
        layer(roundPoly([[58, 226], [142, 226], [132, 262], [68, 262]], 4), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
        layer(roundRect(42, 206, 158, 230, 4), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
    ];

    function pup(cx: number, cy: number, r: number): Layer {
        return layer(circle(cx, cy, r), twoTone(cx, PINK_LIGHT, PINK_DARK), [
            { shape: vline(cx, LINE_WIDTH), color: OUTLINE },
        ]);
    }
}

/** Barrel cactus: a wide ribbed barrel with red spines and a crown of orange flowers, on pebbles. */
function ferocactus(): Layer[] {
    const cx = 100;
    const cy = 178;
    const rx = 82;
    const ry = 90;
    const ribs = [0, 30, 58];
    const spines: Mark[] = [];
    for (const rib of ribs) {
        for (let y = 132; y <= 252; y += 30) {
            const t = (y - cy) / ry;
            const dx = rib * Math.sqrt(Math.max(0, 1 - t * t));
            for (const side of rib === 0 ? [0] : [-1, 1]) {
                const x = cx + side * dx;
                spines.push({ shape: capsule(x, y, x - 4, y - 6, 1), color: SPINE });
                spines.push({ shape: capsule(x, y, x + 4, y - 6, 1), color: SPINE });
            }
        }
    }
    return [
        layer(intersect(ellipse(cx, cy, rx, ry), (_x, y) => y - 264), twoTone(cx, LIME, LIME_DARK), [
            { shape: ring(ellipse(cx, cy, 30, ry), LINE_WIDTH), color: OUTLINE },
            { shape: ring(ellipse(cx, cy, 58, ry), LINE_WIDTH), color: OUTLINE },
            { shape: vline(cx, LINE_WIDTH), color: OUTLINE },
            ...spines,
        ]),
        ...flower({ cx: 70, cy: 98, r: 19, petals: 6, color: ORANGE, center: YELLOW, angle: 30 }),
        ...flower({ cx: 130, cy: 98, r: 19, petals: 6, color: ORANGE, center: YELLOW, angle: 30 }),
        ...flower({ cx: 100, cy: 84, r: 21, petals: 6, color: ORANGE, center: YELLOW }),
        pebble(34, 266, 13, 8),
        pebble(166, 267, 12, 7),
        pebble(150, 270, 7, 5),
    ];
}

/** Prickly pear: pads growing on pads, dotted with areoles, with magenta fruit, on stones. */
function opuntia(): Layer[] {
    return [
        pad(162, 72, 21, 27, 12),
        pad(140, 134, 32, 42, 26),
        pad(62, 132, 26, 34, -28),
        pad(100, 212, 40, 54, -6),
        fruit(150, 50),
        fruit(166, 43),
        fruit(181, 52),
        fruit(46, 100),
        pebble(62, 266, 26, 11),
        pebble(136, 268, 30, 10),
    ];

    function pad(cx: number, cy: number, rx: number, ry: number, angle: number): Layer {
        const shape = ellipse(cx, cy, rx, ry, angle);
        const a = (angle * Math.PI) / 180;
        const areoles: Mark[] = [];
        for (let u = -rx * 0.55; u <= rx * 0.56; u += rx * 0.55) {
            for (let v = -ry * 0.6; v <= ry * 0.61; v += ry * 0.3) {
                const x = cx + u * Math.cos(a) - v * Math.sin(a);
                const y = cy + u * Math.sin(a) + v * Math.cos(a);
                if (shape(x, y) < -6) areoles.push({ shape: circle(x, y, 2), color: CREAM });
            }
        }
        return layer(shape, axisTone(cx, cy, angle, GREEN_LIGHT, GREEN_MID), [
            { shape: axisLine(cx, cy, angle, LINE_WIDTH), color: OUTLINE },
            ...areoles,
        ]);
    }

    function fruit(cx: number, cy: number): Layer {
        return layer(ellipse(cx, cy, 7, 10), twoTone(cx, MAGENTA, [150, 34, 92]), [], SMALL_OUTLINE_WIDTH);
    }
}

/** Rebutia: a cluster of small globes with red flowers round the sides, in a square pot. */
function rebutia(): Layer[] {
    return [
        head(148, 156, 25),
        head(58, 164, 29),
        head(104, 138, 33),
        head(78, 196, 31),
        head(132, 196, 33),
        ...flower({ cx: 30, cy: 190, r: 18, petals: 6, color: RED, center: YELLOW, angle: 15 }),
        ...flower({ cx: 170, cy: 172, r: 18, petals: 6, color: RED, center: YELLOW }),
        ...flower({ cx: 74, cy: 112, r: 17, petals: 6, color: RED, center: YELLOW, angle: 30 }),
        layer(roundRect(30, 222, 170, 268, 5), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
        layer(roundRect(22, 206, 178, 226, 4), twoTone(100, POT_LIGHT, POT_DARK), [{ shape: vline(100, LINE_WIDTH), color: OUTLINE }]),
    ];

    function head(cx: number, cy: number, r: number): Layer {
        const shape = circle(cx, cy, r);
        return layer(shape, twoTone(cx, GREEN_LIGHT, GREEN_MID), [
            { shape: vline(cx, LINE_WIDTH), color: OUTLINE },
            ...flecks(shape, Math.round(r * 0.6), 5, 1.3),
        ]);
    }
}

// ---------------------------------------------------------------------------
// Parts shared by several cacti
// ---------------------------------------------------------------------------

interface FlowerOptions {
    cx: number;
    cy: number;
    r: number;
    petals: number;
    color: Rgb;
    center: Rgb;
    /** Rotation of the first petal, in degrees. */
    angle?: number;
}

/** Petals as one outlined shape, then a round centre. */
function flower(options: FlowerOptions): Layer[] {
    const { cx, cy, r, petals, color, center, angle = 0 } = options;
    const shapes: Sdf[] = [];
    for (let i = 0; i < petals; i++) {
        const a = angle + (360 * i) / petals;
        const rad = (a * Math.PI) / 180;
        shapes.push(ellipse(cx + Math.cos(rad) * r * 0.5, cy + Math.sin(rad) * r * 0.5, r * 0.5, r * 0.38, a));
    }
    return [
        layer(union(...shapes), twoTone(cx, color, shade(color)), [], SMALL_OUTLINE_WIDTH),
        layer(circle(cx, cy, r * 0.3), twoTone(cx, center, shade(center)), [], SMALL_OUTLINE_WIDTH),
    ];
}

function pebble(cx: number, cy: number, rx: number, ry: number): Layer {
    return layer(ellipse(cx, cy, rx, ry), twoTone(cx, STONE_LIGHT, STONE_DARK), [], SMALL_OUTLINE_WIDTH);
}

/** Small light dots scattered inside a shape, placed by a fixed seed so every run draws the same. */
function flecks(shape: Sdf, count: number, seed: number, radius = 1.8): Mark[] {
    const marks: Mark[] = [];
    let state = seed * 2654435761;
    const random = (): number => {
        state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
        return state / 4294967296;
    };
    for (let tries = 0; marks.length < count && tries < count * 50; tries++) {
        const x = random() * WIDTH;
        const y = random() * HEIGHT;
        if (shape(x, y) < -8) marks.push({ shape: circle(x, y, radius), color: FLECK });
    }
    return marks;
}

// ---------------------------------------------------------------------------
// Paints
// ---------------------------------------------------------------------------

/** Light to the left of `x`, dark to the right. */
function twoTone(x: number, light: Rgb, dark: Rgb): Paint {
    return (px) => (px < x ? light : dark);
}

/** Light on one side of a tilted axis through (cx, cy), dark on the other. */
function axisTone(cx: number, cy: number, angle: number, light: Rgb, dark: Rgb): Paint {
    const a = (angle * Math.PI) / 180;
    return (x, y) => ((x - cx) * Math.cos(a) + (y - cy) * Math.sin(a) < 0 ? light : dark);
}

/** A darker shade of a colour, for the right half of two-tone fills. */
function shade(color: Rgb): Rgb {
    return [Math.round(color[0] * 0.82), Math.round(color[1] * 0.82), Math.round(color[2] * 0.82)];
}

// ---------------------------------------------------------------------------
// Shapes (signed distance functions)
// ---------------------------------------------------------------------------

function circle(cx: number, cy: number, r: number): Sdf {
    return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

/** An ellipse, rotated by `angle` degrees. The distance is approximate, which is plenty for edges. */
function ellipse(cx: number, cy: number, rx: number, ry: number, angle = 0): Sdf {
    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return (x, y) => {
        const px = (x - cx) * cos + (y - cy) * sin;
        const py = -(x - cx) * sin + (y - cy) * cos;
        const k0 = Math.hypot(px / rx, py / ry);
        const k1 = Math.hypot(px / (rx * rx), py / (ry * ry));
        return k0 < 1e-6 ? -Math.min(rx, ry) : (k0 * (k0 - 1)) / k1;
    };
}

function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): Sdf {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hx = (x1 - x0) / 2 - r;
    const hy = (y1 - y0) / 2 - r;
    return (x, y) => {
        const qx = Math.abs(x - cx) - hx;
        const qy = Math.abs(y - cy) - hy;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    };
}

function capsule(ax: number, ay: number, bx: number, by: number, r: number): Sdf {
    return (x, y) => {
        const pax = x - ax;
        const pay = y - ay;
        const bax = bx - ax;
        const bay = by - ay;
        const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
        return Math.hypot(pax - bax * h, pay - bay * h) - r;
    };
}

/** A polygon (any winding, convex or not), grown by `r` to round its corners. */
function roundPoly(points: readonly (readonly [number, number])[], r: number): Sdf {
    return (x, y) => {
        let d = (x - points[0][0]) ** 2 + (y - points[0][1]) ** 2;
        let s = 1;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i++) {
            const [vix, viy] = points[i];
            const [vjx, vjy] = points[j];
            const ex = vjx - vix;
            const ey = vjy - viy;
            const wx = x - vix;
            const wy = y - viy;
            const h = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
            d = Math.min(d, (wx - ex * h) ** 2 + (wy - ey * h) ** 2);
            const c1 = y >= viy;
            const c2 = y < vjy;
            const c3 = ex * wy > ey * wx;
            if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
        }
        return s * Math.sqrt(d) - r;
    };
}

/** The band of width `w` along a shape's edge. */
function ring(shape: Sdf, w: number): Sdf {
    return (x, y) => Math.abs(shape(x, y)) - w / 2;
}

/** A vertical line of width `w` at `x`. */
function vline(x: number, w: number): Sdf {
    return (px) => Math.abs(px - x) - w / 2;
}

/** A line of width `w` through (cx, cy), along the long axis of a shape tilted by `angle` degrees. */
function axisLine(cx: number, cy: number, angle: number, w: number): Sdf {
    const a = (angle * Math.PI) / 180;
    return (x, y) => Math.abs((x - cx) * Math.cos(a) + (y - cy) * Math.sin(a)) - w / 2;
}

function union(...shapes: Sdf[]): Sdf {
    return (x, y) => {
        let d = Infinity;
        for (const shape of shapes) d = Math.min(d, shape(x, y));
        return d;
    };
}

function intersect(a: Sdf, b: Sdf): Sdf {
    return (x, y) => Math.max(a(x, y), b(x, y));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Coverage of a pixel by the region where `d < 0`, for a smooth edge. */
function coverage(d: number): number {
    return Math.min(1, Math.max(0, 0.5 - d));
}

function render(layers: readonly Layer[]): Buffer {
    const png = new PNG({ width: WIDTH, height: HEIGHT });
    for (let py = 0; py < HEIGHT; py++) {
        for (let px = 0; px < WIDTH; px++) {
            const x = px + 0.5;
            const y = py + 0.5;
            // Premultiplied colour, composited front over back
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            const over = (color: Rgb, alpha: number): void => {
                r = color[0] * alpha + r * (1 - alpha);
                g = color[1] * alpha + g * (1 - alpha);
                b = color[2] * alpha + b * (1 - alpha);
                a = alpha + a * (1 - alpha);
            };
            for (const l of layers) {
                const d = l.shape(x, y);
                if (d > 1) continue;
                over(OUTLINE, coverage(d));
                const inside = coverage(d + l.outline);
                if (inside <= 0) continue;
                over(l.paint(x, y), inside);
                for (const mark of l.marks) {
                    const m = coverage(mark.shape(x, y));
                    if (m > 0) over(mark.color, m * inside);
                }
            }
            const i = (py * WIDTH + px) * 4;
            png.data[i] = a > 0 ? Math.round(r / a) : 0;
            png.data[i + 1] = a > 0 ? Math.round(g / a) : 0;
            png.data[i + 2] = a > 0 ? Math.round(b / a) : 0;
            png.data[i + 3] = Math.round(a * 255);
        }
    }
    return PNG.sync.write(png);
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

const cacti: Array<[string, Layer[]]> = [
    ['astrophytum.png', astrophytum()],
    ['cereus.png', cereus()],
    ['ferocactus.png', ferocactus()],
    ['gymnocalycium.png', gymnocalycium()],
    ['opuntia.png', opuntia()],
    ['rebutia.png', rebutia()],
];

for (const [name, layers] of cacti) {
    writeFileSync(join(OUT_DIR, name), render(layers));
    console.log(`  wrote ${name} (${WIDTH}×${HEIGHT})`);
}

console.log(`\nDone - ${cacti.length} textures written to ${OUT_DIR}`);
