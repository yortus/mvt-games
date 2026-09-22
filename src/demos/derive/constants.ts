// ---------------------------------------------------------------------------
// Shared demo data
// ---------------------------------------------------------------------------

/** The four entity kinds the world model places on its grid. */
export type EntityKind = 'ruby' | 'jade' | 'amber' | 'quartz';

/** All kinds in canonical (sort-rank) order. */
export const KINDS: readonly EntityKind[] = ['ruby', 'jade', 'amber', 'quartz'];

/** Display colour per kind. */
export const KIND_COLORS: Record<EntityKind, number> = {
    ruby: 0xe0407a,
    jade: 0x40c98a,
    amber: 0xe0a83a,
    quartz: 0x8a7ad0,
};

/** Dense-grid cell code per kind (0 is reserved for "empty"). */
export const KIND_CODES: Record<EntityKind, number> = {
    ruby: 1,
    jade: 2,
    amber: 3,
    quartz: 4,
};

/** Zero-based index / sort rank per kind. */
export const KIND_INDEX: Record<EntityKind, number> = {
    ruby: 0,
    jade: 1,
    amber: 2,
    quartz: 3,
};

/** Colour per dense-grid code; index 0 (empty) is never rendered. */
export const CODE_COLORS: readonly number[] = [
    0x000000,
    KIND_COLORS.ruby,
    KIND_COLORS.jade,
    KIND_COLORS.amber,
    KIND_COLORS.quartz,
];

// ---- Grid + roster defaults -----------------------------------------------

export const DEFAULT_ROWS = 8;
export const DEFAULT_COLS = 11;
export const DEFAULT_COUNT = 22;
export const MIN_ENTITIES = 6;
export const MAX_ENTITIES = 46;
