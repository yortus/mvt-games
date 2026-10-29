import { findScopeSource, SCOPE_POINTS, toScopeLength } from '../shared';

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Attaches a scope to `chip`, which fills it as it plays. Playing music and
 * sounds needs no scope, so a chip draws one only while one is attached: it
 * costs the audio thread a little each block, and the page a copy about 90
 * times a second. A chip that can't show its voices, such as a headless
 * chip, or an object that is not a chip, gives a scope that stays silent.
 * One that is not a chip has no voices.
 */
export function createScope(chip: object): Scope {
    const source = findScopeSource(chip);
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
