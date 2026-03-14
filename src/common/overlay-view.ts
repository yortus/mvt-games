import { Container, Graphics, Text } from 'pixi.js';
import { watch } from './watch';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OverlayViewBindings {
    getWidth(): number;
    getHeight(): number;
    isVisible(): boolean;
    getText(): string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOverlayView(bindings: OverlayViewBindings): Container {
    const view = new Container();
    view.label = 'overlay';

    const watcher = watch({
        visible: bindings.isVisible,
        text: bindings.getText,
    });

    const w = bindings.getWidth();
    const h = bindings.getHeight();

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
    view.addChild(bg);

    const label = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 24, fill: 0xffffff, align: 'center' },
    });
    label.anchor.set(0.5);
    label.position.set(w / 2, h / 2);
    view.addChild(label);

    view.visible = false;

    view.onRender = () => {
        const watched = watcher.poll();
        if (watched.visible.changed) {
            view.visible = watched.visible.value as boolean;
        }
        if (watched.text.changed) {
            label.text = watched.text.value as string;
        }
    };

    return view;
}
