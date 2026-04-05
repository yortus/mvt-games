import { Container, Graphics } from 'pixi.js';
import { createEdgeTween, type StatefulPixiView } from '#common';

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

export function createDeathFlashView(bindings: DeathFlashViewBindings): StatefulPixiView {
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

    view.visible = false;
    view.onRender = refresh;
    return Object.assign(view, { update });

    function update(deltaMs: number): void {
        tween.update(deltaMs);
    }

    function refresh(): void {
        view.visible = tween.value > 0;
        view.alpha = tween.value;
    }
}
