import { derive, type Derived } from '#common';
import type { WorldModel } from '../models';
import { KINDS, KIND_INDEX } from '../constants';

// ---------------------------------------------------------------------------
// Derivation: roster -> per-kind counts
// ---------------------------------------------------------------------------

/**
 * Aggregate kind: reduces the roster to a fixed-size histogram of counts per
 * kind (indexed by {@link KIND_INDEX}). Recomputes only when the roster changes
 * (add/remove/retype) - notably not when the active set toggles. The counts
 * buffer is filled in place.
 */
export function createKindHistogram(model: WorldModel): Derived<Int32Array> {
    return derive({
        watch: { roster: () => model.rosterRevision },
        initial: new Int32Array(KINDS.length),
        compute(counts) {
            counts.fill(0);
            const count = model.entityCount;
            for (let i = 0; i < count; i++) {
                counts[KIND_INDEX[model.getEntity(i).kind]]++;
            }
            return counts;
        },
    });
}
