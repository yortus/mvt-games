import { Container, Graphics } from 'pixi.js';
import { createEdgeTween } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DeathFlashViewBindings {
    getScreenWidth(): number;
    getScreenHeight(): number;
    isDying(): boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLASH_DURATION_MS = 200;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeathFlashView(bindings: DeathFlashViewBindings): Container {
    const tween = createEdgeTween({
        getSource: bindings.isDying,
        triggerValue: 1,
        restValue: 0,
        durationMs: FLASH_DURATION_MS,
    });
    const view = new Container();

    const gfx = new Graphics();
    gfx.rect(0, 0, bindings.getScreenWidth(), bindings.getScreenHeight());
    gfx.fill({ color: 0xffffff });
    view.addChild(gfx);

    view.onUpdate = (deltaMs) => {
        tween.update(deltaMs);
    };

    view.onRefresh = () => {
        // A full-screen flash that fades: it drives its own alpha each frame,
        // since a smooth fade needs alpha rather than a visible toggle.
        view.alpha = tween.value;
    };

    return view;
}
