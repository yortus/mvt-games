/**
 * Generate the pixel-art texture PNGs for Neon Monsoon.
 *
 * Run:  npx tsx scripts/generate-neon-monsoon-textures.ts
 *
 * Every texture is a grid of palette characters. The small sprites are drawn
 * by hand, as text below; the bullets and the large craft are drawn by code,
 * from circles, ellipses, lines and rectangles, into the same kind of grid.
 * All of it is original art made for this game.
 *
 * The palette splits the spectrum in two. Bullets are warm, red to gold, with
 * white-hot cores. Everything else that glows is cool neon, cyan to magenta:
 * thin trim on dark gunmetal craft, with a dim halo pixel beside each trim
 * line, which reads as a glow at this scale.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'neon-monsoon', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0], // transparent
    'W': [255, 255, 255, 255], // white
    // Enemy bullets: warm only, so they never blend into the neon
    'R': [255, 59, 48, 255], // red
    'r': [122, 16, 8, 255], // red rim
    'O': [255, 122, 26, 255], // orange
    'o': [122, 50, 5, 255], // orange rim
    'A': [255, 176, 0, 255], // amber
    'a': [122, 76, 0, 255], // amber rim
    'G': [255, 225, 74, 255], // gold
    'g': [122, 101, 16, 255], // gold rim
    'D': [255, 241, 184, 255], // rain drop
    'd': [154, 112, 32, 255], // rain drop rim
    // The player's ship and shots: steel, with blue neon trim
    'S': [216, 226, 240, 255], // steel, light
    's': [139, 155, 180, 255], // steel
    'k': [74, 86, 112, 255], // steel, dark
    'N': [95, 240, 255, 255], // canopy
    'n': [40, 135, 160, 255], // canopy, dark
    'Q': [224, 247, 255, 255], // shot
    'q': [122, 184, 255, 255], // shot rim
    // Gems
    'X': [125, 255, 192, 255],
    'x': [42, 154, 106, 255],
    // Craft: dark gunmetal
    'H': [74, 79, 99, 255], // hull, light
    'h': [44, 47, 60, 255], // hull
    'f': [22, 23, 31, 255], // hull, dark
    'Z': [26, 16, 40, 255], // the boss's core socket
    'K': [11, 11, 20, 255], // item face
    // Neon, each with a dim halo shade
    'C': [47, 243, 255, 255], // cyan
    'c': [11, 77, 87, 255],
    'M': [255, 43, 214, 255], // magenta
    'm': [90, 15, 76, 255],
    'V': [166, 107, 255, 255], // violet
    'v': [53, 32, 95, 255],
    'L': [61, 123, 255, 255], // blue
    'l': [19, 38, 90, 255],
};

// ---------------------------------------------------------------------------
// Drawing on a grid of palette characters
// ---------------------------------------------------------------------------

type Grid = string[][];

function blank(width: number, height: number): Grid {
    const grid: Grid = [];
    for (let y = 0; y < height; y++) grid.push(new Array<string>(width).fill('.'));
    return grid;
}

function plot(grid: Grid, x: number, y: number, ch: string): void {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = ch;
}

function rect(grid: Grid, x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) plot(grid, i, j, ch);
}

/** A straight line between two pixels (Bresenham). */
function line(grid: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        plot(grid, x0, y0, ch);
        if (x0 === x1 && y0 === y1) return;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
}

/** An ellipse centred on (cx, cy), with radii rx and ry, sampled at pixel centres. */
function ellipse(grid: Grid, cx: number, cy: number, rx: number, ry: number, ch: string): void {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            const dx = (x + 0.5 - cx) / rx;
            const dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) grid[y][x] = ch;
        }
    }
}

function disc(grid: Grid, cx: number, cy: number, r: number, ch: string): void {
    ellipse(grid, cx, cy, r, r, ch);
}

/** A one-pixel ring: the edge of a disc, filled with `ch`, over whatever was there. */
function ring(grid: Grid, cx: number, cy: number, r: number, ch: string): void {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d <= r && d > r - 1) grid[y][x] = ch;
        }
    }
}

/**
 * Give every pixel of neon `core` a dim halo: its neighbours that are one of
 * `over` become `halo`. Over the hull, and over transparency, so the glow
 * spills past the craft's edge.
 */
function haloAround(grid: Grid, core: string, halo: string, over: string): void {
    const marks: [number, number][] = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            if (grid[y][x] !== core) continue;
            for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && over.includes(grid[ny][nx])) marks.push([nx, ny]);
            }
        }
    }
    for (const [x, y] of marks) grid[y][x] = halo;
}

/** Copy the left half onto the right, mirrored, for symmetrical craft. */
function mirror(grid: Grid): Grid {
    const width = grid[0].length;
    for (const row of grid) {
        for (let x = 0; x < width / 2; x++) row[width - 1 - x] = row[x];
    }
    return grid;
}

function rows(grid: Grid): string[] {
    return grid.map((row) => row.join(''));
}

// ---------------------------------------------------------------------------
// Bullets, shots and gems
// ---------------------------------------------------------------------------

/** A round bullet: dark rim, bright body, white-hot core. */
function roundBullet(size: number, body: string, rim: string, coreRadius: number): string[] {
    const g = blank(size, size);
    const c = size / 2;
    disc(g, c, c, c, rim);
    disc(g, c, c, c - 1, body);
    disc(g, c, c, coreRadius, 'W');
    return rows(g);
}

/** A long bullet, drawn pointing right: the view turns it to its direction of travel. */
function longBullet(length: number, thickness: number, body: string, rim: string): string[] {
    const g = blank(length, thickness);
    const c = thickness / 2;
    ellipse(g, length / 2, c, length / 2, c, rim);
    ellipse(g, length / 2, c, length / 2 - 1, Math.max(0.6, c - 1), body);
    rect(g, Math.floor(length * 0.35), Math.floor(c - 0.5), Math.ceil(length * 0.45), 1, 'W');
    return rows(g);
}

function gem(): string[] {
    const g = blank(7, 7);
    for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
            const d = Math.abs(x - 3) + Math.abs(y - 3);
            if (d <= 3) g[y][x] = d === 3 ? 'x' : 'X';
        }
    }
    g[3][3] = 'W';
    g[2][3] = 'W';
    return rows(g);
}

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

/** The interceptor, 16 x 16, nose up, its wings edged in blue neon. */
const INTERCEPTOR: string[] = [
    '.......SS.......',
    '......SNNS......',
    '......SNNS......',
    '.....SSnnSS.....',
    '.....sSSSSs.....',
    '.....sSSSSs.....',
    '....ksSSSSsk....',
    '....ksSSSSsk....',
    '...LksSSSSskL...',
    '..LLksSSSSskLL..',
    '.LkkksSSSSskkkL.',
    'LkkkksSSSSskkkkL',
    'Lkk.ksSSSSsk.kkL',
    'L...ksSkkSsk...L',
    '.....sS..Ss.....',
    '.....kk..kk.....',
];

const INTERCEPTOR_ICON: string[] = [
    '...SS...',
    '..SNNS..',
    '..SSSS..',
    '.LSSSSL.',
    'LLSSSSLL',
    'L.SSSS.L',
    '..S..S..',
    '........',
];

const BOMB_ICON: string[] = [
    '.....W..',
    '....C...',
    '..mmmm..',
    '.mMMMmm.',
    '.mMWMMm.',
    '.mMMMMm.',
    '..mmmm..',
    '........',
];

// ---------------------------------------------------------------------------
// Enemies, nose down: dark hulls with neon trim
// ---------------------------------------------------------------------------

/** A small dart, its leading edges in magenta, converging on a cyan cockpit. */
const KITE: string[] = [
    'm............m',
    'Mm..........mM',
    'hMm..ffff..mMh',
    '.hMmfhhhhfmMh.',
    '..hMhhHHhhMh..',
    '...hMhHHhMh...',
    '....hMCCMh....',
    '.....hCCh.....',
    '......Mm......',
    '......m.......',
];

/** A spear: a cyan spine down a dark shaft, and swept cyan tips. */
const LANCER: string[] = [
    '....hhhh....',
    '...hHHHHh...',
    '..hHcCCcHh..',
    '.hHhhCChhHh.',
    'hCh.hCCh.hCh',
    'hc..hCCh..ch',
    'c...hCCh...c',
    '....hCCh....',
    '....hCCh....',
    '....fCCf....',
    '....fhhf....',
    '.....hh.....',
    '.....hh.....',
    '.....ff.....',
    '.....CC.....',
];

/** A rooftop gun, seen from above: a violet ring round its turret, barrel pointing down. */
function turret(): string[] {
    const g = blank(16, 16);
    disc(g, 8, 7, 7, 'f');
    disc(g, 8, 7, 5.5, 'h');
    ring(g, 8, 7, 5, 'V');
    disc(g, 8, 7, 3.5, 'H');
    rect(g, 7, 9, 2, 7, 'H');
    rect(g, 7, 15, 2, 1, 'V');
    haloAround(g, 'V', 'v', 'hf.');
    disc(g, 8, 7, 1.5, 'W');
    return rows(g);
}

/** A slow, broad carrier: blue engines at the back, circuit traces on its deck, magenta strips along its flanks. */
function barge(): string[] {
    const g = blank(40, 30);
    ellipse(g, 20, 15, 19, 14, 'f');
    ellipse(g, 20, 15, 17, 12, 'h');
    rect(g, 9, 7, 22, 16, 'H');
    rect(g, 10, 8, 20, 14, 'h');
    // Deck traces
    line(g, 12, 10, 18, 10, 'C');
    line(g, 18, 10, 18, 14, 'C');
    line(g, 22, 20, 28, 20, 'C');
    line(g, 22, 16, 22, 20, 'C');
    line(g, 12, 18, 16, 18, 'C');
    // Flank strips
    line(g, 4, 10, 4, 20, 'M');
    line(g, 35, 10, 35, 20, 'M');
    // Engines
    rect(g, 7, 1, 4, 3, 'L');
    rect(g, 29, 1, 4, 3, 'L');
    haloAround(g, 'C', 'c', 'h');
    haloAround(g, 'M', 'm', 'fh.');
    haloAround(g, 'L', 'l', 'fh.');
    disc(g, 20, 15, 2.5, 'f');
    disc(g, 20, 15, 1.5, 'C');
    return rows(g);
}

/** The mid-boss: a heavy gunship, its wings' leading edges in magenta, a cyan spine, and a cannon under each wing. */
function gunship(): string[] {
    const g = blank(56, 34);
    // Wings, swept back toward the top, drawn on the left and mirrored
    for (let y = 6; y < 26; y++) {
        const span = Math.min(27, 8 + (y - 6) * 1.2);
        rect(g, Math.round(28 - span), y, Math.round(span), 1, y % 5 === 0 ? 'f' : 'h');
    }
    // The leading edge of the left wing: its lower, outer side
    line(g, 1, 25, 20, 25, 'M');
    line(g, 1, 25, 1, 21, 'M');
    rect(g, 4, 22, 10, 3, 'f');
    // Wing cannons, at x = 28 - 18 and its mirror, as the patterns expect
    rect(g, 9, 24, 3, 7, 'H');
    rect(g, 9, 31, 3, 1, 'C');
    // Hull and spine
    ellipse(g, 28, 17, 8, 16, 'f');
    ellipse(g, 28, 17, 6, 14, 'h');
    rect(g, 25, 6, 3, 22, 'H');
    line(g, 27, 4, 27, 29, 'C');
    rect(g, 22, 0, 4, 3, 'L');
    mirror(g);
    haloAround(g, 'M', 'm', 'fh.');
    haloAround(g, 'C', 'c', 'fhH');
    haloAround(g, 'L', 'l', 'fh.');
    disc(g, 28, 20, 3, 'V');
    disc(g, 28, 20, 1.5, 'W');
    return rows(g);
}

/**
 * The Stormcore: a broad armoured tower-ship, dark plates with circuit
 * traces running out from its core. The core socket is left dark at
 * (52, 38): the view draws the glowing core there, coloured per attack. The
 * side cannons sit 40 either side of the centre, where the cyclone's streams
 * fire from.
 */
function stormcore(): string[] {
    const g = blank(104, 64);
    ellipse(g, 52, 30, 50, 28, 'f');
    ellipse(g, 52, 30, 47, 25, 'h');
    for (let i = 0; i < 3; i++) {
        ellipse(g, 52, 30, 40 - i * 9, 21 - i * 5, i % 2 === 0 ? 'H' : 'h');
    }
    // Circuit traces running out from the core, turning at right angles
    for (const side of [-1, 1]) {
        line(g, 52 + side * 12, 38, 52 + side * 26, 38, 'C');
        line(g, 52 + side * 26, 38, 52 + side * 26, 24, 'C');
        line(g, 52 + side * 26, 24, 52 + side * 36, 24, 'C');
        line(g, 52 + side * 10, 30, 52 + side * 18, 30, 'V');
        line(g, 52 + side * 18, 30, 52 + side * 18, 14, 'V');
        line(g, 52 + side * 18, 14, 52 + side * 30, 14, 'V');
        line(g, 52 + side * 6, 26, 52 + side * 6, 8, 'C');
    }
    // Side cannon pods, trimmed in cyan
    for (const cx of [12, 92]) {
        disc(g, cx, 40, 8, 'f');
        disc(g, cx, 40, 6, 'h');
        ring(g, cx, 40, 6, 'C');
        rect(g, cx - 2, 40, 4, 12, 'H');
        rect(g, cx - 1, 51, 2, 1, 'C');
    }
    // Engines along the back
    for (let x = 30; x <= 74; x += 11) rect(g, x - 2, 2, 4, 3, 'L');
    // Magenta lights round the rim
    for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * Math.PI * 2;
        plot(g, Math.round(52 + Math.cos(angle) * 46), Math.round(30 + Math.sin(angle) * 25), 'M');
    }
    haloAround(g, 'C', 'c', 'hHf');
    haloAround(g, 'V', 'v', 'hHf');
    haloAround(g, 'M', 'm', 'hf.');
    haloAround(g, 'L', 'l', 'hf.');
    // The core socket, ringed in violet
    disc(g, 52, 38, 11, 'f');
    ring(g, 52, 38, 11, 'V');
    disc(g, 52, 38, 9, 'Z');
    return rows(g);
}

// ---------------------------------------------------------------------------
// Items: neon boxes, so they never look like bullets
// ---------------------------------------------------------------------------

function item(letter: readonly string[], frame: string, halo: string): string[] {
    const g = blank(12, 12);
    rect(g, 0, 0, 12, 12, halo);
    rect(g, 1, 1, 10, 10, frame);
    rect(g, 2, 2, 8, 8, 'K');
    for (let y = 0; y < letter.length; y++) {
        for (let x = 0; x < letter[y].length; x++) {
            if (letter[y][x] === '#') plot(g, 4 + x, 3 + y, 'W');
        }
    }
    return rows(g);
}

const LETTER_P = ['###.', '#..#', '###.', '#...', '#...', '#...'];
const LETTER_B = ['###.', '#..#', '###.', '#..#', '#..#', '###.'];

// ---------------------------------------------------------------------------
// Encode and write
// ---------------------------------------------------------------------------

function encode(textureRows: string[]): Buffer {
    const height = textureRows.length;
    const width = Math.max(...textureRows.map((r) => r.length));
    const png = new PNG({ width, height });

    for (let y = 0; y < height; y++) {
        const row = textureRows[y];
        for (let x = 0; x < width; x++) {
            const ch = x < row.length ? row[x] : '.';
            const [r, g, b, a] = PALETTE[ch] ?? PALETTE['.'];
            const idx = (y * width + x) * 4;
            png.data[idx] = r;
            png.data[idx + 1] = g;
            png.data[idx + 2] = b;
            png.data[idx + 3] = a;
        }
    }

    return PNG.sync.write(png);
}

const allTextures: [string, string[]][] = [
    ['pellet-red.png', roundBullet(8, 'R', 'r', 1.5)],
    ['pellet-orange.png', roundBullet(8, 'O', 'o', 1.5)],
    ['pellet-amber.png', roundBullet(8, 'A', 'a', 1.5)],
    ['pellet-gold.png', roundBullet(8, 'G', 'g', 1.5)],
    ['orb-red.png', roundBullet(14, 'R', 'r', 3.5)],
    ['orb-amber.png', roundBullet(14, 'A', 'a', 3.5)],
    ['needle-orange.png', longBullet(12, 5, 'O', 'o')],
    ['needle-gold.png', longBullet(12, 5, 'G', 'g')],
    ['rain-drop.png', longBullet(12, 3, 'D', 'd')],
    ['shot.png', longBullet(12, 3, 'Q', 'q')],
    ['shot-focused.png', longBullet(14, 5, 'Q', 'q')],
    ['gem.png', gem()],
    ['interceptor.png', INTERCEPTOR],
    ['interceptor-icon.png', INTERCEPTOR_ICON],
    ['bomb-icon.png', BOMB_ICON],
    ['kite.png', KITE],
    ['lancer.png', LANCER],
    ['turret.png', turret()],
    ['barge.png', barge()],
    ['gunship.png', gunship()],
    ['stormcore.png', stormcore()],
    ['item-power.png', item(LETTER_P, 'C', 'c')],
    ['item-bomb.png', item(LETTER_B, 'M', 'm')],
];

for (const [name, textureRows] of allTextures) {
    writeFileSync(join(OUT_DIR, name), encode(textureRows));
    console.log(`  wrote ${name} (${textureRows[0].length}x${textureRows.length})`);
}

console.log(`\nDone - ${allTextures.length} textures written to ${OUT_DIR}`);
