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
    let flashTimer = 0;

    const label = new Text({
        text: 'DESTROY THE BASE!',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xff4444, align: 'center' },
    });
    label.anchor.set(0.5);
    label.position.set(bindings.getScreenWidth() / 2, bindings.getScreenHeight() * 0.2);

    const view = new Container();
    view.addChild(label);
    view.visible = false;
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const shouldShow = bindings.isScrollClamped() && bindings.isBaseAlive();
        view.visible = shouldShow;
        if (!shouldShow) {
            flashTimer = 0;
            return;
        }
        // Flash the text by toggling alpha
        flashTimer += 16;
        view.alpha = (Math.sin(flashTimer * 0.008) + 1) * 0.5;
    }
}
