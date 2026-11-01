import type { Graphics } from 'pixi.js';

/** Draws one coin, centred on 0, 0. */
export function drawCoin(g: Graphics): void {
    g.circle(0, 0, 13).fill(0xffd75e).stroke({ color: 0xb8860b, width: 3 });
}
