import type { Ticker } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A stand-in for Pixi's `Ticker`, for the PixiJS 3D methods that read one,
 * such as `ParticleSystem3D.update(ticker)`. They read only its `deltaMS`.
 * A view passes its own `deltaMs` through the stand-in, so the feature moves
 * only by the views' `deltaMs`, never by the shared ticker's time.
 */
export interface TickerStandIn {
    /** Pass this to the method that reads a ticker. */
    readonly ticker: Ticker;
    /** Sets the step that the stand-in reports, and returns the ticker. It's written in place, so a frame doesn't allocate. */
    step: (deltaMs: number) => Ticker;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a stand-in for Pixi's `Ticker`, which reports a step of 0 until `step` is called. */
export function createTickerStandIn(): TickerStandIn {
    const fields = { deltaMS: 0, deltaTime: 0, elapsedMS: 0 };
    // PixiJS 3D reads only `deltaMS`, so the rest of the `Ticker` type is left out
    const ticker = fields as unknown as Ticker;
    return {
        ticker,
        step: (deltaMs) => {
            fields.deltaMS = deltaMs;
            fields.elapsedMS = deltaMs;
            // In frames of a 60 Hz display, as Pixi's own ticker reports it
            fields.deltaTime = deltaMs / (1000 / 60);
            return ticker;
        },
    };
}
