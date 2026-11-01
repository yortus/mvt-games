import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HoldRingViewBindings {
    /** The ring's radius, in pixels, read once. */
    radius: number;
    /** How far the hold has gone, from 0 to 1. At 0, nothing shows. */
    progress: () => number;
    /** The ring's colour, which can change, such as to stand out on a key lit in blue. */
    color: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The sign of a press being held: a faint ring, and a disc that grows from
 * its middle to fill it as the hold goes on. The same in the walkthrough's
 * demos and in the game, so what the arrow shows is what the player sees.
 * Both are drawn once, in white, and tinted and scaled. Its origin is its
 * middle.
 */
export function HoldRingView(bindings: HoldRingViewBindings): Container {
    const { radius } = bindings;
    const view = new Container();
    view.label = 'hold-ring';
    view.eventMode = 'none';
    const ring = new Graphics().circle(0, 0, radius).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ color: 0xffffff, width: 2.5 });
    const disc = new Graphics().circle(0, 0, radius).fill({ color: 0xffffff, alpha: 0.3 });
    view.addChild(ring, disc);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const progress = bindings.progress();
        view.visible = progress > 0;
        if (!view.visible) return;
        const color = bindings.color();
        ring.tint = color;
        disc.tint = color;
        disc.scale.set(progress);
    }
}
