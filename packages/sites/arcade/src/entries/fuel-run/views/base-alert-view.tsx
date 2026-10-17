/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { PixelTextView } from '#shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BaseAlertViewBindings {
    isScrollClamped: () => boolean;
    isBaseAlive: () => boolean;
    /** Places the alert, so read once. */
    screenWidth: number;
    screenHeight: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A flashing "DESTROY THE BASE!" while the scroll is held at the base and the base still stands. */
export function BaseAlertView(bindings: BaseAlertViewBindings): Container {
    // Presentation state: time elapsed, for the flash.
    let flashMs = 0;

    return (
        <container
            visible={() => bindings.isScrollClamped() && bindings.isBaseAlive()}
            alpha={() => (Math.sin(flashMs * 0.008) + 1) * 0.5}
            onUpdate={(deltaMs) => { flashMs += deltaMs; }}
        >
            <container x={bindings.screenWidth / 2} y={Math.round(bindings.screenHeight * 0.2)}>
                <PixelTextView text="DESTROY THE BASE!" color={ALERT_COLOR} scale={2} anchorX={0.5} anchorY={0.5} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Its color. It is set in the pixel glyphs at twice their size. */
const ALERT_COLOR = 0xff4444;
