import { Container, Graphics } from 'pixi.js';
import { watch } from '#common';

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

export function createDeathFlashView(bindings: DeathFlashViewBindings): Container {
    const FLASH_DURATION_MS = 200;

    const watcher = watch({ dying: bindings.isDying });

    let timerMs = FLASH_DURATION_MS;

    const gfx = new Graphics();
    gfx.rect(0, 0, bindings.getScreenWidth(), bindings.getScreenHeight());
    gfx.fill({ color: 0xffffff });

    const view = new Container();
    view.addChild(gfx);
    view.visible = false;
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.dying.changed && watched.dying.value) {
            timerMs = 0;
            view.visible = true;
            view.alpha = 1;
        }

        if (timerMs >= FLASH_DURATION_MS) return;

        timerMs += 16;

        if (timerMs >= FLASH_DURATION_MS) {
            view.visible = false;
        }
        else {
            view.alpha = 1 - timerMs / FLASH_DURATION_MS;
        }
    }
}
