import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createBooleanTween } from '@mvtjs/utils';
import { easeOutBack, easeOutQuad } from './easings';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StatusIconViewBindings {
    readonly isBuffed: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A lightning bolt that lights up and bounces as a power-up starts, and dims
 * as it ends. A boolean tween keeps its state: it follows `isBuffed`, and
 * turns round smoothly if the flag flips back half way.
 */
export function StatusIconView(bindings: StatusIconViewBindings): Container {
    const view = new Container();
    const icon = new Graphics();
    icon.poly([4, -30, -14, 4, 0, 4, -6, 30, 14, -6, 0, -6, 6, -30]).fill(0x7fe0ff);
    icon.position.set(540, 95);
    view.addChild(icon);

    // 0 with no power-up, 1 with one. It overshoots a little as it lights, which is the bounce.
    const boost = createBooleanTween({
        getSource: bindings.isBuffed,
        offValue: 0,
        onValue: 1,
        onDurationMs: 450,
        offDurationMs: 300,
        onEasing: easeOutBack,
        offEasing: easeOutQuad,
    });

    setUpdate(view, boost.update);
    setRefresh(view, () => {
        icon.scale.set(0.8 + 0.5 * boost.value);
        icon.alpha = 0.25 + 0.75 * Math.min(boost.value, 1);
    });
    return view;
}
