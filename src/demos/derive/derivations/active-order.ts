import { derive, type Derived } from '#common';
import type { WorldModel, WorldEntity } from '../models';
import { KIND_INDEX } from '../constants';

// ---------------------------------------------------------------------------
// Derivation: roster -> ordered list of active entities
// ---------------------------------------------------------------------------

/**
 * Filter + sort kind: selects the active entities and orders them by kind rank
 * then id. Recomputes when either the roster (add/remove/retype) or the active
 * set (toggle) changes. The output array is reused in place across recomputes.
 */
export function createActiveOrder(model: WorldModel): Derived<WorldEntity[]> {
    return derive({
        watch: {
            roster: () => model.rosterRevision,
            active: () => model.activeRevision,
        },
        initial: [] as WorldEntity[],
        compute(list) {
            list.length = 0;
            const count = model.entityCount;
            for (let i = 0; i < count; i++) {
                const e = model.getEntity(i);
                if (e.active) list.push(e);
            }
            list.sort(byKindThenId);
            return list;
        },
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function byKindThenId(a: WorldEntity, b: WorldEntity): number {
    const rank = KIND_INDEX[a.kind] - KIND_INDEX[b.kind];
    return rank !== 0 ? rank : a.id - b.id;
}
