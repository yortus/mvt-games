// A chip's side of a scope: the layout of what it sends, and how it is
// found. The scope a view reads, and `createScope`, which attaches one, are
// in the tracker folder.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a chip that can show its voices gives `createScope`, which each
 * chip's factory registers with `registerScopeSource`. It is the chip's
 * inside: the code that plays on the chip never sees it.
 */
export interface ScopeSource {
    /** How many voices the chip has. */
    readonly voiceCount: number;
    /**
     * Starts filling `data` with each scope as it comes: `voiceCount` voices'
     * points, then their pans. A chip sends scopes only while one is
     * attached.
     */
    attach: (data: Float32Array) => void;
    /** Stops filling `data`. */
    detach: (data: Float32Array) => void;
}

/**
 * Keeps the scopes attached to a chip, for its source: it says whether any
 * is attached, and copies each scope that comes into every one.
 */
export interface ScopeTargets {
    /** Whether any scope is attached. */
    readonly isAttached: boolean;
    /** Attaches `data`, and returns whether it is the first. */
    attach: (data: Float32Array) => boolean;
    /** Detaches `data`, and returns whether it was the last. */
    detach: (data: Float32Array) => boolean;
    /** Copies `scope` into every scope attached. */
    fill: (scope: Float32Array) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many points of each voice a scope keeps. */
export const SCOPE_POINTS = 64;

/**
 * How many samples apart a scope's points are: one every eighth sample, so a
 * scope shows 512 samples, about 11 ms at 48 kHz, long enough for a cycle of
 * a bass note.
 */
export const SCOPE_STRIDE = 8;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Registers how `chip` fills a scope, for `createScope`. A chip's factory calls it once, as it makes the chip. */
export function registerScopeSource(chip: object, source: ScopeSource): void {
    SOURCES.set(chip, source);
}

/** How `chip` fills a scope, as its factory registered it, or undefined for an object that is not a chip that can show its voices. */
export function findScopeSource(chip: object): ScopeSource | undefined {
    return SOURCES.get(chip);
}

/** How many numbers a scope of `voiceCount` voices holds: each voice's points, then each voice's pan. */
export function toScopeLength(voiceCount: number): number {
    return voiceCount * (SCOPE_POINTS + 1);
}

/** Creates a chip's scope targets, with none attached. */
export function createScopeTargets(): ScopeTargets {
    const targets: Float32Array[] = [];
    return {
        get isAttached() {
            return targets.length > 0;
        },
        attach(data) {
            targets.push(data);
            return targets.length === 1;
        },
        detach(data) {
            const at = targets.indexOf(data);
            if (at < 0) return false;
            targets.splice(at, 1);
            return targets.length === 0;
        },
        fill(scope) {
            for (let i = 0; i < targets.length; i++) targets[i].set(scope);
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Each chip's scope source, by chip. It is private to the package, so a
 * chip carries nothing for its scope, and an object that isn't a chip has
 * none.
 */
const SOURCES = new WeakMap<object, ScopeSource>();
