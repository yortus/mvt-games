import { describe, expect, it } from 'vitest';
import { CAT_SPAWNS, MAZE_DATA, PEN_EXIT } from '../data';
import { createCatModel, type CatBehavior, type CatMode } from './cat-model';

describe('CatModel', () => {
    const BEHAVIORS: CatBehavior[] = ['chase', 'ambush', 'flank', 'fickle'];

    it('leaves the pen and stays out, even when its target is below the pen', () => {
        // A still target in the bottom-left corridor, which pulls the cats
        // back toward the bottom of the pen at every step inside it
        const target = { row: 16, col: 1, direction: 'left' as const };

        for (let i = 0; i < CAT_SPAWNS.length; i++) {
            const cat = createCatModel({
                startRow: CAT_SPAWNS[i][0],
                startCol: CAT_SPAWNS[i][1],
                speed: 4,
                behavior: BEHAVIORS[i],
                isWalkable: (r, c) => tileAt(r, c) !== 'wall',
                chaseTarget: target,
                homeCorner: { row: MAZE_DATA.length - 1, col: 0 },
                isInPen: (r, c) => tileAt(r, c) === 'pen',
                penExit: { row: PEN_EXIT[0], col: PEN_EXIT[1] },
            });

            let hasLeft = false;
            for (let t = 0; t < 10_000; t += 16) {
                cat.update(16);
                const inPen = tileAt(Math.round(cat.row), Math.round(cat.col)) === 'pen';
                if (hasLeft) expect(inPen, `cat ${i} went back into the pen`).toBe(false);
                if (!inPen) hasLeft = true;
            }
            expect(hasLeft, `cat ${i} never left the pen`).toBe(true);
        }
    });
});

function tileAt(row: number, col: number): string {
    return MAZE_DATA[row]?.[col] ?? 'wall';
}

describe('CatModel in its pen', () => {
    it('paces up and down its column of the pen until it is released, then leaves', () => {
        const [startRow, startCol] = CAT_SPAWNS[1];
        const releaseDelayMs = 3000;
        const cat = createCatModel({
            startRow,
            startCol,
            speed: 4,
            behavior: 'chase',
            isWalkable: (r, c) => tileAt(r, c) !== 'wall',
            chaseTarget: { row: 16, col: 1, direction: 'left' },
            homeCorner: { row: 0, col: 0 },
            releaseDelayMs,
            isInPen: (r, c) => tileAt(r, c) === 'pen',
            penExit: { row: PEN_EXIT[0], col: PEN_EXIT[1] },
        });
        let hasMoved = false;
        for (let t = 0; t < releaseDelayMs; t += 16) {
            cat.update(16);
            expect(cat.col).toBe(startCol);
            expect(tileAt(Math.round(cat.row), Math.round(cat.col))).toBe('pen');
            if (cat.row !== startRow) hasMoved = true;
        }
        expect(hasMoved).toBe(true);
        for (let t = 0; t < 5000; t += 16) cat.update(16);
        expect(cat.releaseInMs).toBe(0);
        expect(tileAt(Math.round(cat.row), Math.round(cat.col))).not.toBe('pen');
    });
});

describe('CatModel out in the maze', () => {
    it('turns back at the next tile as the mode changes', () => {
        let mode: CatMode = 'chase';
        // Out of the pen, in the long corridor along the top, heading right
        const cat = createCatModel({
            startRow: 1,
            startCol: 10,
            startDirection: 'right',
            speed: 4,
            behavior: 'chase',
            isWalkable: (r, c) => tileAt(r, c) !== 'wall',
            // Far ahead along the corridor, so the cat keeps going right
            chaseTarget: { row: 1, col: 26, direction: 'left' },
            homeCorner: { row: 1, col: 26 },
            mode: () => mode,
        });
        for (let t = 0; t < 600; t += 16) cat.update(16);
        expect(cat.direction).toBe('right');
        mode = 'scatter';
        for (let t = 0; t < 300; t += 16) cat.update(16);
        expect(cat.direction).toBe('left');
    });
});
