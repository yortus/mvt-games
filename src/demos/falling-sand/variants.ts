import type { GrainStorageKind, TankSizeKind } from './models';
import type { GrainsViewKind } from './views';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The implementations the demo runs with, and the tank's size. Chosen once,
 * when the demo starts, and fixed for its life: changing one starts the demo
 * afresh, in a new page. Comparing implementations fairly needs that, since
 * V8 optimises each call site for the functions it has seen there, and a
 * page that had run two implementations would run both of them worse.
 *
 * Kept in the page's URL, as `?storage=arrays&view=pixels&tank=large`.
 */
export interface DemoVariants {
    readonly storage: GrainStorageKind;
    readonly grainsView: GrainsViewKind;
    readonly tankSize: TankSizeKind;
}

export const DEFAULT_VARIANTS: DemoVariants = { storage: 'objects', grainsView: 'sprites', tankSize: 'small' };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** The variants in a URL's query string (`location.search`). Missing or unknown values fall back to the defaults. */
export function parseVariants(search: string): DemoVariants {
    const params = new URLSearchParams(search);
    return {
        storage: pick(params.get('storage'), STORAGES, DEFAULT_VARIANTS.storage),
        grainsView: pick(params.get('view'), GRAINS_VIEWS, DEFAULT_VARIANTS.grainsView),
        tankSize: pick(params.get('tank'), TANK_SIZES, DEFAULT_VARIANTS.tankSize),
    };
}

/**
 * `search` with the variants set in it, as a query string starting with `?`.
 * Other parameters in `search` are kept.
 */
export function formatVariants(search: string, variants: DemoVariants): string {
    const params = new URLSearchParams(search);
    params.set('storage', variants.storage);
    params.set('view', variants.grainsView);
    params.set('tank', variants.tankSize);
    return `?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STORAGES: readonly GrainStorageKind[] = ['objects', 'arrays'];
const GRAINS_VIEWS: readonly GrainsViewKind[] = ['sprites', 'pixels'];
const TANK_SIZES: readonly TankSizeKind[] = ['small', 'medium', 'large'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
    return allowed.find((kind) => kind === value) ?? fallback;
}
