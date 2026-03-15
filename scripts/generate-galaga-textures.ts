/**
 * Generate retro pixel-art texture PNGs for Galaga.
 *
 * Run:  npx tsx scripts/generate-galaga-textures.ts
 *
 * Each texture is defined as a grid of palette-index characters.
 * The script encodes them into tiny PNG files using `pngjs`.
 */

import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Output directory
// ---------------------------------------------------------------------------

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'galaga', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0],           // transparent
    K: [0, 0, 0, 255],           // black
    W: [255, 255, 255, 255],     // white
    // Boss colours
    B: [68, 68, 204, 255],       // boss body blue
    b: [102, 102, 255, 255],     // boss crown blue-light
    P: [85, 85, 221, 255],       // boss face plate
    R: [255, 0, 0, 255],         // red (eyes)
    D: [51, 51, 170, 255],       // boss jaw dark
    S: [85, 85, 204, 255],       // boss wing side
    // Butterfly colours
    r: [204, 51, 68, 255],       // butterfly body
    F: [255, 68, 102, 255],      // butterfly wing bright
    f: [221, 51, 85, 255],       // butterfly lower wing
    O: [255, 170, 136, 255],     // butterfly wing spot
    p: [255, 102, 136, 255],     // butterfly antenna tip
    // Bee colours
    Y: [255, 204, 0, 255],       // bee body yellow
    y: [255, 221, 68, 255],      // bee head lighter yellow
    s: [34, 34, 0, 255],         // bee stripe dark
    A: [170, 221, 255, 128],     // bee wing translucent blue
    d: [221, 170, 0, 255],       // bee stinger
    // Ship colours
    C: [136, 204, 255, 255],     // ship cyan highlight
    c: [204, 204, 255, 255],     // ship wing
    L: [68, 136, 255, 255],      // ship wing tip blue
    G: [255, 102, 0, 255],       // engine glow orange
    g: [255, 204, 0, 255],       // engine glow yellow
    // Ship lives icon colour
    I: [136, 204, 255, 255],     // icon cyan
};

// ---------------------------------------------------------------------------
// Texture definitions (character grids)
// ---------------------------------------------------------------------------

/** Boss - 16×16 blue/purple beetle commander */
const BOSS: string[] = [
    '....b..KK..b....',
    '...bB..KK..Bb...',
    '..bBB.KKKK.BBb..',
    '..bBBBBBBBBBBb..',
    '.SBBBBBBBBBBBS..',
    '.SBBBWWBBWWBBBS.',
    '.SBBBWRBBWRBBBS.',
    '..BBBPPPPPPBBB..',
    '..BBPPPPPPPPBB..',
    '..BBBBDDDDBBBB..',
    '.SBBBBBBBBBBBBS.',
    '.S.BBBBBBBBBB.S.',
    '....BBBBBBBB....',
    '....BB....BB....',
    '....BB....BB....',
    '................',
];

/** Butterfly - 16×16 angular wings */
const BUTTERFLY: string[] = [
    '....p....p......',
    '...p......p.....',
    '..F..K..K..F....',
    '.FF..KWKW..FF...',
    'FFF..rrrr..FFF..',
    'FFFO.rrrr.OFFF..',
    '.FFF.rrrr.FFF...',
    '..FF.rrrr.FF....',
    '..ffrrrrrrf.....',
    '.fff.rrrr.fff...',
    '.ff..rrrr..ff...',
    '......rr........',
    '......rr........',
    '................',
    '................',
    '................',
];

/** Bee - 16×16 yellow/black */
const BEE: string[] = [
    '......KK........',
    '.....KyyK.......',
    '....KyyyyK......',
    '....KWKKWKt.....',
    '...AKYYYYKA.....',
    '..AAKYYYYKAAh...',
    '..AAKssssKAA....',
    '...AKYYYYKA.....',
    '....KssssK......',
    '....KYYYYK......',
    '....KssssK......',
    '.....KYYK.......',
    '......Kd........',
    '......Kd........',
    '.......d........',
    '................',
];

/** Player ship - 16×16, facing up */
const SHIP: string[] = [
    '.......WW.......',
    '......WCCW......',
    '......WCCW......',
    '.....WWCCWW.....',
    '.....WCCCW......',
    '....WWWWWWW.....',
    '....WWWWWWW.....',
    '...cWWWWWWWc....',
    '..ccWWWWWWWcc...',
    '.cccWWWWWWWccc..',
    'LccWWWWWWWWccL..',
    'L.cWWWWWWWWc.L..',
    '....GGGGGG......',
    '....GgGGgG......',
    '.....gggg.......',
    '................',
];

/** Player bullet - 3×8 white capsule */
const BULLET_PLAYER: string[] = [
    '.W.',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    'WWW',
    '.W.',
];

/** Enemy bullet - 3×8 red capsule */
const BULLET_ENEMY: string[] = [
    '.R.',
    'RRR',
    'RRR',
    'RRR',
    'RRR',
    'RRR',
    'RRR',
    '.R.',
];

/** Ship lives icon - 8×8 tiny ship for HUD */
const SHIP_ICON: string[] = [
    '...CC...',
    '..CWWC..',
    '..CWWC..',
    '.cWWWWc.',
    'cWWWWWWc',
    'LWWWWWWL',
    '..GGGG..',
    '...gg...',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

function encode(rows: string[]): Buffer {
    const height = rows.length;
    const width = Math.max(...rows.map((r) => r.length));
    const png = new PNG({ width, height });

    for (let y = 0; y < height; y++) {
        const row = rows[y];
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

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

const textures: Array<[string, string[]]> = [
    ['boss.png', BOSS],
    ['butterfly.png', BUTTERFLY],
    ['bee.png', BEE],
    ['ship.png', SHIP],
    ['bullet-player.png', BULLET_PLAYER],
    ['bullet-enemy.png', BULLET_ENEMY],
    ['ship-icon.png', SHIP_ICON],
];

for (const [name, rows] of textures) {
    const buf = encode(rows);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${rows[0].length}×${rows.length})`);
}

console.log(`\nDone - ${textures.length} textures written to ${OUT_DIR}`);
