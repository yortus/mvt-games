// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a renderer gives the runner: what `start` is given besides the sound,
 * and the steps of a frame over the root the project's views go in.
 */
export interface RendererHost<O> {
    readonly startOptions: O;
    /** Calls `updateView` over the root. */
    readonly update: (deltaMs: number) => void;
    /** Calls `refreshView` over the root. */
    readonly refresh: () => void;
    /** Draws the frame, where the renderer draws to a canvas. */
    readonly render: () => void;
    /** Returns the GPU's milliseconds per frame since the last call, where the renderer can time the GPU. */
    readonly takeGpuMs?: () => number | undefined;
}
