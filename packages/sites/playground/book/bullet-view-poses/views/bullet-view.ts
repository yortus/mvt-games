import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * How opaque the bullet is drawn. Set it to 0, as last week's change did:
 * every test's view.visible stays true, and every bullet disappears.
 */
const BULLET_ALPHA = 1;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    readonly x: () => number;
    readonly y: () => number;
    readonly isInFlight: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A bullet: a glowing streak, shown while it's in flight. */
export function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();

    // Drawn once, centred on 0, 0
    const bullet = new Graphics();
    bullet.roundRect(-16, -7, 32, 14, 7).fill({ color: 0xffdd55, alpha: 0.25 });
    bullet.roundRect(-12, -4, 24, 8, 4).fill(0xffee99);
    bullet.alpha = BULLET_ALPHA;
    view.addChild(bullet);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        view.visible = bindings.isInFlight();
        view.position.set(bindings.x(), bindings.y());
    }
}
