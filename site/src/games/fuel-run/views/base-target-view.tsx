/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BaseTargetViewBindings {
    screenX: () => number;
    screenY: () => number;
    isBaseAlive: () => boolean;
    /** Sizes the base's graphics, so read once. */
    tileSize: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The enemy base at the end of section 3: a red structure that pulses to draw attention. */
export function BaseTargetView(bindings: BaseTargetViewBindings): Container {
    const { tileSize } = bindings;
    // Presentation state: time elapsed, for the pulse.
    let flashMs = 0;

    return (
        <container
            visible={bindings.isBaseAlive}
            x={bindings.screenX}
            y={bindings.screenY}
            scale={() => 0.85 + 0.15 * Math.sin(flashMs * 0.006)}
            onUpdate={(deltaMs) => { flashMs += deltaMs; }}
        >
            <graphics ref={(g) => drawBody(g, tileSize)} />
            <graphics ref={(g) => drawInner(g, tileSize)} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Main body - large red structure. */
function drawBody(g: Graphics, tileSize: number): void {
    const width = tileSize * 2;
    const height = tileSize * 1.5;
    g.rect(-width / 2, -height / 2, width, height);
    g.fill(0xcc2222);
    g.stroke({ color: 0xff4444, width: 2 });
}

/** Inner detail - dark centre. */
function drawInner(g: Graphics, tileSize: number): void {
    const width = tileSize * 2 * 0.5;
    const height = tileSize * 1.5 * 0.4;
    g.rect(-width / 2, -height / 2, width, height);
    g.fill(0x881111);
}
