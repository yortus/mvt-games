import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createEdgeTween } from '@mvtjs/utils';
import { easeOutQuad } from './easings';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HurtFlashViewBindings {
    readonly isHurt: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A red flash over the panel, once each time the player is hurt. An edge
 * tween keeps the flash's state: it plays each time `isHurt` turns from
 * `false` to `true`, and rests at 0 in between.
 */
export function HurtFlashView(bindings: HurtFlashViewBindings): Container {
    const view = new Container();
    const overlay = new Graphics();
    overlay.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 14).fill(0xff3344);
    view.addChild(overlay);

    const hurtFlash = createEdgeTween({
        getSource: bindings.isHurt,
        triggerValue: 1,     // full flash as the hurt starts
        restValue: 0,        // invisible at rest
        durationMs: 400,
        easing: easeOutQuad,
    });

    setUpdate(view, hurtFlash.update);
    setRefresh(view, () => {
        overlay.alpha = 0.7 * hurtFlash.value;
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// The HUD's panel, which the flash covers
const PANEL_X = 40;
const PANEL_Y = 40;
const PANEL_W = 560;
const PANEL_H = 110;
