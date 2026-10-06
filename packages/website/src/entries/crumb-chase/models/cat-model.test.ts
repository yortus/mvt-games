import { describe, expect, it } from 'vitest';
import { CAT_SPAWNS, MAZE_DATA, PEN_EXIT } from '../data';
import { createCatModel, type CatBehavior } from './cat-model';

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
                scatterTarget: { row: MAZE_DATA.length - 1, col: 0 },
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
