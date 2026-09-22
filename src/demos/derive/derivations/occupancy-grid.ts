import { derive, type Derived } from '#common';
import type { WorldModel } from '../models';
import { KIND_CODES } from '../constants';

// ---------------------------------------------------------------------------
// Derivation: sparse entities -> dense occupancy grid
// ---------------------------------------------------------------------------

/**
 * Reshape kind: turns the sparse list of placed entities into a dense
 * `rows * cols` grid of kind codes (0 = empty). Recomputes only when the grid
 * revision or the dimensions change; the buffer is reused in place and only
 * reallocated on a resize.
 */
export function createOccupancyGrid(model: WorldModel): Derived<Uint8Array> {
    return derive({
        watch: {
            rev: () => model.gridRevision,
            rows: () => model.rows,
            cols: () => model.cols,
        },
        initial: new Uint8Array(0),
        compute(buffer, watched) {
            const cols = watched.cols.value;
            const size = watched.rows.value * cols;
            if (buffer.length !== size) buffer = new Uint8Array(size);
            else buffer.fill(0);

            const count = model.entityCount;
            for (let i = 0; i < count; i++) {
                const e = model.getEntity(i);
                buffer[e.row * cols + e.col] = KIND_CODES[e.kind];
            }
            return buffer;
        },
    });
}
