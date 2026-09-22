import { Container, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BaseAlertViewBindings {
    isScrollClamped(): boolean;
    isBaseAlive(): boolean;
    getScreenWidth(): number;
    getScreenHeight(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBaseAlertView(bindings: BaseAlertViewBindings): Container {
    let flashMs = 0;

    const label = new Text({
        text: 'DESTROY THE BASE!',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xff4444, align: 'center' },
    });
    label.anchor.set(0.5);
    label.position.set(bindings.getScreenWidth() / 2, bindings.getScreenHeight() * 0.2);

    const view = new Container();
    view.addChild(label);

    view.onUpdate = (deltaMs) => {
        flashMs += deltaMs;
    };

    view.onRefresh = () => {
        const isShown = view.visible = bindings.isScrollClamped() && bindings.isBaseAlive();
        if (!isShown) return;
        view.alpha = (Math.sin(flashMs * 0.008) + 1) * 0.5;
    };

    return view;
}
