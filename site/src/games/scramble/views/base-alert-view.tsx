/** @jsxImportSource @mvtjs/pixi/jsx */

import type { Container } from 'pixi.js';

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
            <text
                text="DESTROY THE BASE!"
                anchor={0.5}
                x={bindings.screenWidth / 2}
                y={bindings.screenHeight * 0.2}
                style={ALERT_STYLE}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ALERT_STYLE = { fontFamily: 'monospace', fontSize: 18, fill: 0xff4444, align: 'center' };
