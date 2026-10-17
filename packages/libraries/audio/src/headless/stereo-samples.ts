// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Rendered stereo sound: the left and right channels, each -1 to 1, and the
 * same length. A stereo chip, such as the Audio90, renders it. A mono chip,
 * such as the Audio80, renders one `Float32Array`, which a browser plays on
 * both speakers.
 */
export interface StereoSamples {
    readonly left: Float32Array;
    readonly right: Float32Array;
}

/** Rendered sound of either kind: one channel, or two. */
export type RenderedSamples = Float32Array | StereoSamples;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Lists the channels of `samples`: one for mono sound, the left and right for stereo. */
export function listChannels(samples: RenderedSamples): readonly Float32Array[] {
    return samples instanceof Float32Array ? [samples] : [samples.left, samples.right];
}
