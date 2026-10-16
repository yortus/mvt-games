import { describe, expect, it } from 'vitest';
import { CAT_SPAWNS, MAZE_COLS, MAZE_DATA, MAZE_ROWS, MOUSE_SPAWN, PEN_EXIT } from './maze-data';

describe('maze data', () => {
    it('is a 22 × 28 grid', () => {
        expect(MAZE_ROWS).toBe(22);
        expect(MAZE_COLS).toBe(28);
        for (let r = 0; r < MAZE_DATA.length; r++) {
            expect(MAZE_DATA[r].length).toBe(MAZE_COLS);
        }
    });

    it('is enclosed by walls', () => {
        for (let c = 0; c < MAZE_COLS; c++) {
            expect(MAZE_DATA[0][c]).toBe('wall');
            expect(MAZE_DATA[MAZE_ROWS - 1][c]).toBe('wall');
        }
        for (let r = 0; r < MAZE_ROWS; r++) {
            expect(MAZE_DATA[r][0]).toBe('wall');
            expect(MAZE_DATA[r][MAZE_COLS - 1]).toBe('wall');
        }
    });

    it('lets the mouse reach every crumb, and the cats leave the pen', () => {
        const reached = reachableFrom(MOUSE_SPAWN);
        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                if (MAZE_DATA[r][c] !== 'wall') expect(reached.has(r * MAZE_COLS + c)).toBe(true);
            }
        }
        for (let i = 0; i < CAT_SPAWNS.length; i++) {
            const [r, c] = CAT_SPAWNS[i];
            expect(MAZE_DATA[r][c]).toBe('pen');
        }
    });

    it('puts the pen exit just outside the pen', () => {
        const [r, c] = PEN_EXIT;
        expect(MAZE_DATA[r][c]).toBe('crumb');
        expect(MAZE_DATA[r + 1][c]).toBe('pen');
    });

    it('has no dead ends', () => {
        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                if (MAZE_DATA[r][c] === 'wall') continue;
                let exits = 0;
                for (let i = 0; i < STEPS.length; i++) {
                    if (isOpen(r + STEPS[i][0], c + STEPS[i][1])) exits++;
                }
                expect(exits, `tile ${r},${c}`).toBeGreaterThanOrEqual(2);
            }
        }
    });
});

const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function isOpen(row: number, col: number): boolean {
    return row >= 0 && row < MAZE_ROWS && col >= 0 && col < MAZE_COLS && MAZE_DATA[row][col] !== 'wall';
}

function reachableFrom(start: [number, number]): Set<number> {
    const reached = new Set<number>([start[0] * MAZE_COLS + start[1]]);
    const queue: [number, number][] = [start];
    for (let next = queue.pop(); next; next = queue.pop()) {
        const [r, c] = next;
        for (let i = 0; i < STEPS.length; i++) {
            const nr = r + STEPS[i][0];
            const nc = c + STEPS[i][1];
            const key = nr * MAZE_COLS + nc;
            if (isOpen(nr, nc) && !reached.has(key)) {
                reached.add(key);
                queue.push([nr, nc]);
            }
        }
    }
    return reached;
}
