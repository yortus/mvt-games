import { Container, Graphics } from 'pixi.js';
import { type StatefulPixiView } from '#common';
import { createDeathFlashViewModel } from './death-flash-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DeathFlashViewBindings {
    getScreenWidth(): number;
    getScreenHeight(): number;
    isDying(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeathFlashView(bindings: DeathFlashViewBindings): StatefulPixiView {
    const vm = createDeathFlashViewModel({
        getIsDying: bindings.isDying,
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
        vm.update(deltaMs);
    }

    function refresh(): void {
        view.visible = vm.isVisible;
        view.alpha = vm.alpha;
    }
}
