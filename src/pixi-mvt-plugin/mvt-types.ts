// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Advances a view's cosmetic presentation state. Always fires, every tick. */
export type UpdateHook = (deltaMs: number) => void;

/** Syncs a view's presentation output from model state. Must be idempotent. */
export type RefreshHook = () => void;
