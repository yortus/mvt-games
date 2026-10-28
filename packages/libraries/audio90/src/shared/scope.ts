// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What each voice of a chip is playing, for a view to draw, as an
 * oscilloscope draws a signal. `createScope` attaches one to a chip, which
 * fills it about 90 times a second, until `destroy`. A scope is the same
 * object, with the same arrays, for its life, so a view can read the arrays
 * once and their contents every frame.
 */
export interface Scope {
    /** How many voices the chip has, and so how many the scope shows. */
    readonly voiceCount: number;
    /**
     * Each voice's last `SCOPE_POINTS` points, voice by voice: voice `v`'s
     * are from `v * SCOPE_POINTS`. A point is the voice's output, about -1 to
     * 1 for a voice at full volume. A silent voice's points are 0. The points
     * go round and round, so the newest is not always last.
     */
    readonly points: Float32Array;
    /** Each voice's pan, from -1 (left) to 1 (right). A mono chip's are all 0, as are a silent voice's. */
    readonly pans: Float32Array;
    /** Detaches the scope, and fills it with 0. The chip stops sending scopes once none is attached. */
    destroy: () => void;
}

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

/**
 * Attaches a scope to `chip`, which fills it as it plays. Playing music and
 * sounds needs no scope, so a chip draws one only while one is attached: it
 * costs the audio thread a little each block, and the page a copy about 90
 * times a second. A chip that can't show its voices, such as a headless chip
 * that doesn't render, or an object that is not a chip, gives a scope that
 * stays silent. One that is not a chip has no voices.
 */
export function createScope(chip: object): Scope {
    const source = SOURCES.get(chip);
    const voiceCount = source?.voiceCount ?? 0;
    const data = new Float32Array(toScopeLength(voiceCount));
    source?.attach(data);
    let isAttached = true;
    return {
        voiceCount,
        points: data.subarray(0, voiceCount * SCOPE_POINTS),
        pans: data.subarray(voiceCount * SCOPE_POINTS),
        destroy() {
            if (!isAttached) return;
            isAttached = false;
            source?.detach(data);
            data.fill(0);
        },
    };
}

/** Registers how `chip` fills a scope, for `createScope`. A chip's factory calls it once, as it makes the chip. */
export function registerScopeSource(chip: object, source: ScopeSource): void {
    SOURCES.set(chip, source);
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
