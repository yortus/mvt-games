/**
 * Extract individual fighter frame PNGs from the IK master spritesheet.
 *
 * Run:  npx tsx scripts/generate-ik-textures.ts
 *
 * Source: src/games/ik/planning/ik-c64-textures.png (master spritesheet)
 * Output: src/games/ik/assets/<frame-name>.png (individual frame PNGs)
 *
 * Each frame is 48x42 pixels, extracted from a grid with 52px horizontal
 * stride (4px gap) and variable vertical positions. The flat grey background
 * (149, 149, 149) within each frame is replaced with full transparency.
 */

import { PNG } from 'pngjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SRC_PATH = join(import.meta.dirname, '..', 'src', 'games', 'ik', 'planning', 'ik-c64-textures.png');
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'games', 'ik', 'assets');

// ---------------------------------------------------------------------------
// Frame geometry
// ---------------------------------------------------------------------------

const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 42;
const H_STRIDE = 52; // 48px frame + 4px gap
const X_OFFSET = 4; // first frame starts at x=4

/**
 * Verified y-start for each sprite row. These are NOT uniformly spaced -
 * rows 9-11 have reduced vertical spacing due to label bands of varying
 * height. Values verified programmatically against the source image.
 */
const ROW_Y_STARTS = [
    14, // row 0:  walk
    70, // row 1:  jump + front somersault
    126, // row 2:  back somersault
    182, // row 3:  kicks
    238, // row 4:  punches
    294, // row 5:  back kick + roundhouse
    350, // row 6:  foot sweep + crouch punch
    406, // row 7:  flying kick
    462, // row 8:  turning + blocking
    518, // row 9:  defeat A, B
    566, // row 10: defeat C, D
    622, // row 11: won + lost poses
];

// ---------------------------------------------------------------------------
// Frame definitions: [rowIndex, frameIndexInRow, frameName]
// ---------------------------------------------------------------------------

const FRAME_DEFS: ReadonlyArray<readonly [number, number, string]> = [
    // Row 0: Walk cycle (8 frames)
    [0, 0, 'walk-1'],
    [0, 1, 'walk-2'],
    [0, 2, 'walk-3'],
    [0, 3, 'walk-4'],
    [0, 4, 'walk-5'],
    [0, 5, 'walk-6'],
    [0, 6, 'walk-7'],
    [0, 7, 'walk-8'],

    // Row 1: Jump pose (1) + front somersault (6)
    [1, 0, 'jump-1'],
    [1, 1, 'fwd-sault-1'],
    [1, 2, 'fwd-sault-2'],
    [1, 3, 'fwd-sault-3'],
    [1, 4, 'fwd-sault-4'],
    [1, 5, 'fwd-sault-5'],
    [1, 6, 'fwd-sault-6'],

    // Row 2: Back somersault (6)
    [2, 0, 'back-sault-1'],
    [2, 1, 'back-sault-2'],
    [2, 2, 'back-sault-3'],
    [2, 3, 'back-sault-4'],
    [2, 4, 'back-sault-5'],
    [2, 5, 'back-sault-6'],

    // Row 3: Kick variants (7 frames)
    [3, 0, 'kick-1'],
    [3, 1, 'kick-2'],
    [3, 2, 'kick-3'],
    [3, 3, 'kick-4'],
    [3, 4, 'kick-5'],
    [3, 5, 'kick-6'],
    [3, 6, 'kick-7'],

    // Row 4: Punch variants (6 frames)
    [4, 0, 'punch-1'],
    [4, 1, 'punch-2'],
    [4, 2, 'punch-3'],
    [4, 3, 'punch-4'],
    [4, 4, 'punch-5'],
    [4, 5, 'punch-6'],

    // Row 5: Back kick (3) + roundhouse (4)
    [5, 0, 'back-kick-1'],
    [5, 1, 'back-kick-2'],
    [5, 2, 'back-kick-3'],
    [5, 3, 'roundhouse-1'],
    [5, 4, 'roundhouse-2'],
    [5, 5, 'roundhouse-3'],
    [5, 6, 'roundhouse-4'],

    // Row 6: Foot sweep (6) + crouch punch (2)
    [6, 0, 'footsweep-1'],
    [6, 1, 'footsweep-2'],
    [6, 2, 'footsweep-3'],
    [6, 3, 'footsweep-4'],
    [6, 4, 'footsweep-5'],
    [6, 5, 'footsweep-6'],
    [6, 6, 'crouch-punch-1'],
    [6, 7, 'crouch-punch-2'],

    // Row 7: Flying kick (5)
    [7, 0, 'flying-kick-1'],
    [7, 1, 'flying-kick-2'],
    [7, 2, 'flying-kick-3'],
    [7, 3, 'flying-kick-4'],
    [7, 4, 'flying-kick-5'],

    // Row 8: Turning (5) + blocking (3)
    [8, 0, 'turn-1'],
    [8, 1, 'turn-2'],
    [8, 2, 'turn-3'],
    [8, 3, 'turn-4'],
    [8, 4, 'turn-5'],
    [8, 5, 'block-1'],
    [8, 6, 'block-2'],
    [8, 7, 'block-3'],

    // Row 9: Defeat variants A (3) + B (3)
    [9, 0, 'defeat-a-1'],
    [9, 1, 'defeat-a-2'],
    [9, 2, 'defeat-a-3'],
    [9, 3, 'defeat-b-1'],
    [9, 4, 'defeat-b-2'],
    [9, 5, 'defeat-b-3'],

    // Row 10: Defeat variants C (3) + D (3)
    [10, 0, 'defeat-c-1'],
    [10, 1, 'defeat-c-2'],
    [10, 2, 'defeat-c-3'],
    [10, 3, 'defeat-d-1'],
    [10, 4, 'defeat-d-2'],
    [10, 5, 'defeat-d-3'],

    // Row 11: Won poses (2) + lost pose (1)
    // (4 additional HUD/bonus frames in this row are intentionally skipped)
    [11, 0, 'won-1'],
    [11, 1, 'won-2'],
    [11, 2, 'lost-1'],
];

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function main(): void {
    // Read source spritesheet
    const srcBuf = readFileSync(SRC_PATH);
    const src = PNG.sync.read(srcBuf);
    const srcW = src.width;

    // Detect the frame background colour by sampling a known background
    // position within the first walk frame (top-left corner area)
    const sampleX = X_OFFSET + 2;
    const sampleY = ROW_Y_STARTS[0] + 2;
    const sampleIdx = (sampleY * srcW + sampleX) * 4;
    const bgR = src.data[sampleIdx];
    const bgG = src.data[sampleIdx + 1];
    const bgB = src.data[sampleIdx + 2];
    console.log(`Detected frame background colour: (${bgR}, ${bgG}, ${bgB})`);

    // Ensure output directory exists
    mkdirSync(OUT_DIR, { recursive: true });

    let extracted = 0;
    let bgMissing = 0;

    for (const [rowIdx, frameIdx, name] of FRAME_DEFS) {
        const srcX = X_OFFSET + frameIdx * H_STRIDE;
        const srcY = ROW_Y_STARTS[rowIdx];

        // Create output PNG
        const out = new PNG({ width: FRAME_WIDTH, height: FRAME_HEIGHT });

        let frameBgFound = false;

        for (let dy = 0; dy < FRAME_HEIGHT; dy++) {
            for (let dx = 0; dx < FRAME_WIDTH; dx++) {
                const si = ((srcY + dy) * srcW + (srcX + dx)) * 4;
                const di = (dy * FRAME_WIDTH + dx) * 4;

                const r = src.data[si];
                const g = src.data[si + 1];
                const b = src.data[si + 2];

                if (r === bgR && g === bgG && b === bgB) {
                    // Replace background with transparency
                    out.data[di] = 0;
                    out.data[di + 1] = 0;
                    out.data[di + 2] = 0;
                    out.data[di + 3] = 0;
                    frameBgFound = true;
                }
                else {
                    out.data[di] = r;
                    out.data[di + 1] = g;
                    out.data[di + 2] = b;
                    out.data[di + 3] = 255;
                }
            }
        }

        if (!frameBgFound) {
            console.warn(`  WARNING: no background pixels found in ${name}`);
            bgMissing++;
        }

        const outPath = join(OUT_DIR, `${name}.png`);
        writeFileSync(outPath, PNG.sync.write(out));
        extracted++;
    }

    console.log(
        `\nDone - ${extracted} frames extracted to ${OUT_DIR}` +
        (bgMissing > 0 ? ` (${bgMissing} frames had no background pixels)` : ''),
    );
}

main();
