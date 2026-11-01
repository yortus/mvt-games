/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    readonly x: () => number;
    readonly y: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One bullet. It has no binding that says whether it's there: in a
 * `<List>`, its slot hides it while the slot is empty.
 */
export function BulletView(bindings: BulletViewBindings): Container {
    return <graphics x={bindings.x} y={bindings.y} ref={drawBullet} />;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawBullet(g: Graphics): void {
    g.roundRect(-7, -2, 14, 4, 2).fill(0xffe08a);
}
