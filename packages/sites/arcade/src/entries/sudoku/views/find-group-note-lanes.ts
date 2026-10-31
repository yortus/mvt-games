import type { GroupNote } from '../models';

/**
 * Returns a lane for each group note, so notes that share a cell are drawn
 * apart: each takes the lowest lane that no earlier note sharing a cell
 * with it has taken. A note in a lane above 0 has its lines and label off
 * to one side.
 */
export function findGroupNoteLanes(notes: readonly GroupNote[]): number[] {
    const lanes: number[] = [];
    for (let n = 0; n < notes.length; n++) {
        const { cells } = notes[n];
        let lane = 0;
        while (notes.some((other, o) => o < n && lanes[o] === lane && other.cells.some((cell) => cells.includes(cell)))) lane++;
        lanes.push(lane);
    }
    return lanes;
}
