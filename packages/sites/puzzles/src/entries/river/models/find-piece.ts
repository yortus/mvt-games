/**
 * Returns the cell that stands for the stretch of river that `cell` is in,
 * so two cells are in the same stretch if they return the same cell.
 * `piece` holds a parent for each cell, and a cell that is its own parent
 * stands for its stretch. This is a union-find, also called a disjoint-set
 * forest. To join two stretches, set one's cell as the other's parent. On
 * the way up, it points each cell it passes straight at the cell it
 * returns, so later calls take fewer steps.
 */
export function findPiece(piece: Int32Array, cell: number): number {
    let root = cell;
    while (piece[root] !== root) root = piece[root];
    while (piece[cell] !== root) {
        const next = piece[cell];
        piece[cell] = root;
        cell = next;
    }
    return root;
}
