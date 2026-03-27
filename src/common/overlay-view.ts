import { Container, Graphics, Text } from 'pixi.js';
import { watch } from './watch';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OverlayViewBindings {
    getWidth(): number;
    getHeight(): number;
    getVisible(): boolean;
    getText(): string;
    onRestartPressed?(pressed: boolean): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOverlayView(bindings: OverlayViewBindings): Container {
    const view = new Container();
    view.label = 'overlay';

    const watcher = watch({
        visible: bindings.getVisible,
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

    if (bindings.onRestartPressed) {
        bg.eventMode = 'static';
        bg.cursor = 'pointer';
        const onRestartPressed = bindings.onRestartPressed;
        bg.on('pointerdown', () => onRestartPressed(true));
        const delayedRelease = (): void => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    onRestartPressed(false);
                });
            });
        };
        bg.on('pointerup', delayedRelease);
        bg.on('pointerupoutside', delayedRelease);
        bg.on('pointercancel', delayedRelease);
    }

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
