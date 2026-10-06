/**
 * Generate retro pixel-art texture PNGs for Galaxy Raiders.
 *
 * Run:  npx tsx scripts/generate-galaxy-raiders-textures.ts
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

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'entries', 'galaxy-raiders', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0], // transparent
    'K': [0, 0, 0, 255], // black
    'W': [255, 255, 255, 255], // white
    'R': [255, 0, 0, 255], // red (enemy bullet)
    // Drone hull colours, shared by all three drones
    'h': [196, 204, 220, 255], // hull highlight
    'M': [128, 138, 160, 255], // hull steel
    'm': [72, 80, 100, 255], // hull shadow
    // Drone lights
    'T': [0, 220, 200, 255], // teal core
    't': [0, 120, 120, 255], // teal core rim
    'X': [255, 70, 210, 255], // magenta light
    'x': [150, 30, 130, 255], // magenta light, dim
    'V': [150, 90, 230, 255], // violet wing (striker)
    'v': [90, 50, 160, 255], // violet wing shadow (striker)
    // Ship colours
    'C': [136, 204, 255, 255], // ship cyan highlight
    'c': [204, 204, 255, 255], // ship wing
    'L': [68, 136, 255, 255], // ship wing tip blue
    'G': [255, 102, 0, 255], // engine glow orange
    'g': [255, 204, 0, 255], // engine glow yellow
    // Ship lives icon colour
    'I': [136, 204, 255, 255], // icon cyan
};

// ---------------------------------------------------------------------------
// Texture definitions (character grids)
// ---------------------------------------------------------------------------

/** Carrier - 16×16 hexagonal command drone with a glowing core */
const CARRIER: string[] = [
    '.....x....x.....',
    '.....m....m.....',
    '....mmhhhhmm....',
    '...mhhMMMMhhm...',
    '..mhMMmmmmMMhm..',
    '.mhMMmttttmMMhm.',
    'XmhMmtTTTTtmMhmX',
    'mhMMmtTXXTtmMMhm',
    'mhMMmtTXXTtmMMhm',
    'XmhMmtTTTTtmMhmX',
    '.mhMMmttttmMMhm.',
    '..mhMMmmmmMMhm..',
    '...mhhMMMMhhm...',
    '....mmMMMMmm....',
    '.....m.XX.m.....',
    '................',
];

/** Striker - 16×16 delta-wing interceptor, nose down */
const STRIKER: string[] = [
    'X..............X',
    'vX............Xv',
    'vVv..........vVv',
    '.vVV...hh...VVv.',
    '.vVVV.hMMh.VVVv.',
    '..vVVVMTTMVVVv..',
    '..vvVVMTTMVVvv..',
    '...vvVMttMVvv...',
    '....vvMMMMvv....',
    '.....mMhhMm.....',
    '......MhhM......',
    '......mMMm......',
    '.......XX.......',
    '.......xx.......',
    '................',
    '................',
];

/** Scout - 16×16 small orb with a single lens */
const SCOUT: string[] = [
    '................',
    '.......X........',
    '.......m........',
    '.....mmmmmm.....',
    '....mhhMMMMm....',
    '...mhMMMMMMMm...',
    '...mMMmxxmMMm...',
    '...mMmxXXxmMm...',
    '...mMmxXhxmMm...',
    '...mMMmxxmMMm...',
    '...mMMMMMMMMm...',
    '....mMMMMMMm....',
    '.....mmmmmm.....',
    '....m......m....',
    '...x........x...',
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
const BULLET_PLAYER: string[] = ['.W.', 'WWW', 'WWW', 'WWW', 'WWW', 'WWW', 'WWW', '.W.'];

/** Enemy bullet - 3×8 red capsule */
const BULLET_ENEMY: string[] = ['.R.', 'RRR', 'RRR', 'RRR', 'RRR', 'RRR', 'RRR', '.R.'];

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
    ['carrier.png', CARRIER],
    ['striker.png', STRIKER],
    ['scout.png', SCOUT],
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
