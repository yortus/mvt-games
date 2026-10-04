/** Shared labels for param values in printed tables. */
export const DYNAMIC_PROPERTIES_LABELS: Readonly<Record<string, string>> = {
    1: '1 dynamic, 2 static',
    3: '3 dynamic',
};

/** The ways of keeping Pixi containers in step with the model; see `createSyncedScene`. */
export const APPROACH_LABELS: Readonly<Record<string, string>> = {
    'model-only': 'model only, no view',
    'hand-written': 'MVT (hand-written)',
    'jsx': 'MVT (JSX)',
    'events': 'events',
    'solid': 'Solid signals',
    'wasteful': 'MVT (hand-written, wasteful)',
    'container-only': 'bare container',
};
