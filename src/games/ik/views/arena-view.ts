import { Container, Graphics } from 'pixi.js';
import { GROUND_Y_PX } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Minimal background for playtesting context: sky + ground.
 */
export function createArenaView(width: number, height: number): Container {
    const view = new Container();
    view.label = 'arena';

    // Sky
    const sky = new Graphics();
    sky.rect(0, 0, width, GROUND_Y_PX).fill(0x5c94fc); // C64-ish sky blue
    view.addChild(sky);

    // Ground
    const ground = new Graphics();
    ground.rect(0, GROUND_Y_PX, width, height - GROUND_Y_PX).fill(0x228b22); // Forest green
    view.addChild(ground);

    return view;
}
