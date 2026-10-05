/**
 * Generate retro pixel-art texture PNGs for Burrow Bust.
 *
 * Run:  npx tsx scripts/generate-burrow-bust-textures.ts
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

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'entries', 'burrow-bust', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (hex RGBA)
// ---------------------------------------------------------------------------

type Rgba = [number, number, number, number];

const PALETTE: Record<string, Rgba> = {
    '.': [0, 0, 0, 0], // transparent
    'K': [0, 0, 0, 255], // black
    'W': [255, 255, 255, 255], // white (eyes)
    // Miner colours
    'H': [240, 196, 150, 255], // skin
    'Y': [250, 200, 40, 255], // hard hat yellow
    'y': [255, 250, 200, 255], // headlamp
    'Z': [200, 150, 20, 255], // hard hat brim
    'O': [235, 120, 30, 255], // overalls orange
    'o': [170, 80, 20, 255], // overalls shadow, belt
    'k': [70, 55, 45, 255], // boots
    'g': [150, 150, 160, 255], // pump nozzle
    // Mole colours
    'B': [120, 98, 88, 255], // mole fur
    'b': [70, 55, 50, 255], // mole fur shadow
    'p': [240, 150, 165, 255], // mole snout
    'c': [235, 225, 200, 255], // mole claws
    'L': [165, 145, 135, 255], // mole fur, inflating
    'P': [205, 190, 182, 255], // mole fur, inflated
    // Salamander colours
    'D': [58, 40, 70, 255], // salamander body
    'd': [140, 120, 160, 255], // salamander outline
    'S': [255, 210, 40, 255], // salamander spots
    'F': [255, 130, 30, 255], // salamander spots, orange
    'e': [110, 92, 125, 255], // salamander body, inflating
    'E': [165, 150, 180, 255], // salamander body, inflated
    // Shared by the most inflated frames
    'Q': [228, 218, 210, 255], // pale, about to pop
    // Rock colours
    'N': [150, 145, 140, 255], // stone
    'n': [90, 86, 82, 255], // stone cracks
    'R': [200, 195, 188, 255], // stone highlight
};

// ---------------------------------------------------------------------------
// Miner textures (16×16, facing right)
// ---------------------------------------------------------------------------

const DIGGER_IDLE: string[] = [
    '................',
    '.....YYYY.......',
    '....YYYYYYyy....',
    '....ZZZZZZZZZ...',
    '.....HHHH.......',
    '.....HHKH.......',
    '.....HHHH.......',
    '....OOOOOO......',
    '...HOOOOOOH.....',
    '...HOOOOOOH.....',
    '....oooooo......',
    '....OOOOOO......',
    '....OO..OO......',
    '....OO..OO......',
    '....kk..kk......',
    '...kkk..kkk.....',
];

const DIGGER_WALK_A: string[] = [
    '................',
    '.....YYYY.......',
    '....YYYYYYyy....',
    '....ZZZZZZZZZ...',
    '.....HHHH.......',
    '.....HHKH.......',
    '.....HHHH.......',
    '....OOOOOO......',
    '...HOOOOOOOH....',
    '..H.OOOOOO......',
    '....oooooo......',
    '....OOOOOO......',
    '...OO....OO.....',
    '..OO......OO....',
    '..kk.......kk...',
    '.kkk.......kkk..',
];

const DIGGER_WALK_B: string[] = [
    '................',
    '.....YYYY.......',
    '....YYYYYYyy....',
    '....ZZZZZZZZZ...',
    '.....HHHH.......',
    '.....HHKH.......',
    '.....HHHH.......',
    '....OOOOOO......',
    '...HOOOOOOH.....',
    '....OOOOOO.H....',
    '....oooooo......',
    '....OOOOOO......',
    '.....OOOO.......',
    '.....OO.OO......',
    '.....kk.kk......',
    '....kkk.kkk.....',
];

const DIGGER_PUMP: string[] = [
    '................',
    '.....YYYY.......',
    '....YYYYYYyy....',
    '....ZZZZZZZZZ...',
    '.....HHHH.......',
    '.....HHKH.......',
    '.....HHHH.......',
    '....OOOOOO......',
    '....OOOOOOHHgg..',
    '....OOOOOOHHggg.',
    '....oooooo......',
    '....OOOOOO......',
    '....OO..OO......',
    '....OO..OO......',
    '....kk..kk......',
    '...kkk..kkk.....',
];

/** Miner lives icon - 8×8 */
const DIGGER_ICON: string[] = [
    '..YYYY..',
    '.YYYYYy.',
    '..HHKH..',
    '..HHHH..',
    '.OOOOOO.',
    '..OOOO..',
    '..O..O..',
    '..k..k..',
];

// ---------------------------------------------------------------------------
// Mole textures (16×16, facing right)
// ---------------------------------------------------------------------------

const MOLE: string[] = [
    '................',
    '................',
    '................',
    '................',
    '.....bbbbb......',
    '...bbBBBBBbb....',
    '..bBBBBBBBBBb...',
    '..bBBBBBBBKBBb..',
    '.bBBBBBBBBBBBpp.',
    '.bBBBBBBBBBBppp.',
    '.bBBBBBBBBBBBpp.',
    '.bBBBBBBBBBBBb..',
    '..bBBBBBBBBBc.c.',
    '..bBBBBBBBBcc...',
    '...bbBBBBbb.....',
    '...cc.....cc....',
];

/** Second walking frame: a hop, with the body up a pixel and the claws shifted */
const MOLE_STEP: string[] = [
    '................',
    '................',
    '................',
    '.....bbbbb......',
    '...bbBBBBBbb....',
    '..bBBBBBBBBBb...',
    '..bBBBBBBBKBBb..',
    '.bBBBBBBBBBBBpp.',
    '.bBBBBBBBBBBppp.',
    '.bBBBBBBBBBBBpp.',
    '.bBBBBBBBBBBBb..',
    '..bBBBBBBBBBcc..',
    '..bBBBBBBBBBc.c.',
    '...bbBBBBbb.....',
    '....bb...bb.....',
    '....cc...cc.....',
];

const MOLE_INFLATE1: string[] = [
    '................',
    '................',
    '................',
    '................',
    '.....LLLLL......',
    '...LLLLLLLLL....',
    '..LLLLLLLLLLL...',
    '..LLLLLLLLKLL...',
    '.LLLLLLLLLLLLpp.',
    '.LLLLLLLLLLLppp.',
    '.LLLLLLLLLLLLpp.',
    '.LLLLLLLLLLLLL..',
    '..LLLLLLLLLLL...',
    '..LLLLLLLLLLL...',
    '...LLLLLLLLL....',
    '....c.LLL.c.....',
];

const MOLE_INFLATE2: string[] = [
    '................',
    '................',
    '................',
    '.....PPPPPP.....',
    '...PPPPPPPPPP...',
    '..PPPPPPPPPPPP..',
    '.PPPPPPPPPPKPPP.',
    '.PPPPPPPPPPPPPpp',
    'PPPPPPPPPPPPPppp',
    'PPPPPPPPPPPPPPpp',
    'PPPPPPPPPPPPPPP.',
    '.PPPPPPPPPPPPPP.',
    '.PPPPPPPPPPPPPP.',
    '..PPPPPPPPPPPP..',
    '...PPPPPPPPPP...',
    '.....PPPPPP.....',
];

const MOLE_INFLATE3: string[] = [
    '................',
    '................',
    '....QQQQQQQQ....',
    '..QQQQQQQQQQQQ..',
    '.QQQQQQQQQQQQQQ.',
    '.QQQQQQQQQQKQQQ.',
    'QQQQQQQQQQQQQQpp',
    'QQQQQQQQQQQQQppp',
    'QQQQQQQQQQQQQQpp',
    'QQQQQQQQQQQQQQQQ',
    'QQQQQQQQQQQQQQQQ',
    'QQQQQQQQQQQQQQQQ',
    '.QQQQQQQQQQQQQQ.',
    '.QQQQQQQQQQQQQQ.',
    '..QQQQQQQQQQQQ..',
    '....QQQQQQQQ....',
];

const MOLE_CRUSHED: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..bbbbbbbbbbbp..',
    '.bBBBBBBBBBKBpp.',
    '.cc.........cc..',
];

// ---------------------------------------------------------------------------
// Salamander textures (16×16, facing right)
// ---------------------------------------------------------------------------

const SALAMANDER: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........dddd..',
    '.........dDDDDd.',
    '.........DDDWKdd',
    '....dddddDSDDDDd',
    '..ddDDSDDDDDDDd.',
    '.dDDDDDDDFDDSd..',
    'dDFDdDSDDDDDDd..',
    'd...dDDDDDSDd...',
    '....dDd...dDd...',
    '...dd.....dd....',
];

/** Second walking frame: legs swapped and the tail tip flicked up */
const SALAMANDER_STEP: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........dddd..',
    '.........dDDDDd.',
    '.........DDDWKdd',
    '....dddddDSDDDDd',
    '..ddDDSDDDDDDDd.',
    'ddDDDDDDDFDDSd..',
    'dDFDdDSDDDDDDd..',
    '....dDDDDDSDd...',
    '...dDd.....dDd..',
    '....dd.....dd...',
];

const SALAMANDER_INFLATE1: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....eeeeee.....',
    '...eeeeeeeeee...',
    '..eeSeeeeeWKe...',
    '.eeeeeeFeeeeee..',
    '.eeeeSeeeeeSeee.',
    'deFeeeeeeeeeeee.',
    '.eeeeeeSeeeFee..',
    '..eeeeeeeeeee...',
    '...eeeeeeeeee...',
    '....dd....dd....',
];

const SALAMANDER_INFLATE2: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....EEEEEEE.....',
    '..EEEEEEEEEEE...',
    '.EESEEEEEEWKEE..',
    '.EEEEEEFEEEEEEE.',
    'EEEEESEEEEEESEEE',
    'EEFEEEEEEEEEEEEE',
    'EEEEEEEESEEEFEEE',
    '.EEEEEEEEEEEEEE.',
    '.EEEEEEEEEEEEEE.',
    '..EEEEEEEEEEEE..',
    '....EEEEEEEE....',
];

const SALAMANDER_INFLATE3: string[] = [
    '................',
    '................',
    '................',
    '....QQQQQQQQ....',
    '..QQQQQQQQQQQQ..',
    '.QQSQQQQQQQWKQQ.',
    '.QQQQQQQFQQQQQQ.',
    'QQQQQSQQQQQQQSQQ',
    'QQFQQQQQQQQQQQQQ',
    'QQQQQQQQQSQQQFQQ',
    'QQQQQQQQQQQQQQQQ',
    'QQQSQQQQQQQQQQQQ',
    '.QQQQQQQQFQQQQQ.',
    '.QQQQQQQQQQQQQQ.',
    '..QQQQQQQQQQQQ..',
    '....QQQQQQQQ....',
];

const SALAMANDER_CRUSHED: string[] = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...ddddddddddd..',
    '.dDDSDDDFDDSDKd.',
    '..dd.......dd...',
];

// ---------------------------------------------------------------------------
// Ghosting eyes (20×20, the texture's own size, so the two eyes come out
// pixel for pixel alike): all an enemy shows while it drifts through dirt.
// Outlined to read on any earth colour; the pupils look forward.
// ---------------------------------------------------------------------------

const GHOST_EYES: string[] = [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....KKKKK.KKKKK.....',
    '...KWWWWWKWWWWWK....',
    '...KWWWWWKWWWWWK....',
    '...KWWWKWKWWWKWK....',
    '...KWWKKWKWWKKWK....',
    '...KWWKKWKWWKKWK....',
    '...KWWKKWKWWKKWK....',
    '...KWWWWWKWWWWWK....',
    '....KKKKK.KKKKK.....',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
];

// ---------------------------------------------------------------------------
// Rock textures (16×16)
// ---------------------------------------------------------------------------

const ROCK: string[] = [
    '................',
    '....NNNN........',
    '...NNNNNN.......',
    '..NNNNNNNN......',
    '..NNNNnNNNN.....',
    '.NNNnNNNNNNN....',
    '.NNNNNNNNNNNN...',
    '.NNRNNNNNNNNN...',
    '.NNNNNnNNNNNN...',
    '..NNNNnNNNNN....',
    '..NNNNNNNNN.....',
    '...NNNNNNNN.....',
    '....NNNNNN......',
    '.....NNN........',
    '................',
    '................',
];

const ROCK_SHATTERED: string[] = [
    '................',
    '...NN...........',
    '.NNN....NN......',
    '...N.....NNN....',
    '..........N.....',
    '................',
    '.NN.............',
    'NNN....NNN......',
    '..N.....NNNN....',
    '........NNN.....',
    '.....NN.........',
    '......NNN..NN...',
    '.........N..NNN.',
    '..........NN....',
    '................',
    '................',
];

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

/** Tile size the textures will be displayed at. */
const TARGET_TILE = 20;
/** Icon target size (HUD lives). */
const TARGET_ICON = 10;

function encode(rows: string[], targetW: number, targetH: number): Buffer {
    const srcH = rows.length;
    const srcW = Math.max(...rows.map((row) => row.length));
    const png = new PNG({ width: targetW, height: targetH });

    for (let oy = 0; oy < targetH; oy++) {
        const sy = Math.floor((oy * srcH) / targetH);
        const row = rows[sy];
        for (let ox = 0; ox < targetW; ox++) {
            const sx = Math.floor((ox * srcW) / targetW);
            const ch = sx < row.length ? row[sx] : '.';
            const [r, g, b, a] = PALETTE[ch] ?? PALETTE['.'];
            const idx = (oy * targetW + ox) * 4;
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
    // Miner
    ['digger-idle.png', DIGGER_IDLE],
    ['digger-walk-a.png', DIGGER_WALK_A],
    ['digger-walk-b.png', DIGGER_WALK_B],
    ['digger-pump.png', DIGGER_PUMP],
    ['digger-icon.png', DIGGER_ICON],
    // Mole
    ['mole.png', MOLE],
    ['mole-step.png', MOLE_STEP],
    ['mole-inflate1.png', MOLE_INFLATE1],
    ['mole-inflate2.png', MOLE_INFLATE2],
    ['mole-inflate3.png', MOLE_INFLATE3],
    ['mole-crushed.png', MOLE_CRUSHED],
    // Salamander
    ['salamander.png', SALAMANDER],
    ['salamander-step.png', SALAMANDER_STEP],
    ['salamander-inflate1.png', SALAMANDER_INFLATE1],
    ['salamander-inflate2.png', SALAMANDER_INFLATE2],
    ['salamander-inflate3.png', SALAMANDER_INFLATE3],
    ['salamander-crushed.png', SALAMANDER_CRUSHED],
    // Shared
    ['ghost-eyes.png', GHOST_EYES],
    // Rock
    ['rock.png', ROCK],
    ['rock-shattered.png', ROCK_SHATTERED],
];

for (const [name, rows] of textures) {
    const isIcon = name.includes('icon');
    const target = isIcon ? TARGET_ICON : TARGET_TILE;
    const buf = encode(rows, target, target);
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, buf);
    console.log(`  wrote ${name} (${target}×${target})`);
}

console.log(`\nDone - ${textures.length} textures written to ${OUT_DIR}`);
