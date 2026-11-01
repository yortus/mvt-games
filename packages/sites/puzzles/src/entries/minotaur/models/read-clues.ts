import { PASSAGE } from './edge-states';
import type { MazeGrid } from './maze-grid';

/**
 * Returns the clue of each of `grid`'s lines: the lengths of its stretches of
 * wall, in order along it, from the edges' `states`. Any edge that isn't a
 * passage counts as wall. A line with no wall has an empty clue.
 */
export function readClues(grid: MazeGrid, states: Readonly<Uint8Array>): readonly (readonly number[])[] {
    const clues: number[][] = [];
    for (let line = 0; line < grid.lineCount; line++) {
        const edges = grid.lineEdges[line];
        const runs: number[] = [];
        let run = 0;
        for (let i = 0; i < edges.length; i++) {
            if (states[edges[i]] !== PASSAGE) run++;
            else if (run > 0) {
                runs.push(run);
                run = 0;
            }
        }
        if (run > 0) runs.push(run);
        clues.push(runs);
    }
    return clues;
}
