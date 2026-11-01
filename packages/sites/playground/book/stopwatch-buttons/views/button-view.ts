import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    readonly label: () => string;
    readonly isEnabled: () => boolean;
    /** Called when the player clicks the button while it's enabled. */
    readonly onClicked?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A button, 140 wide and 44 tall. It reports a click, and leaves what the
 * click means to whoever wired it.
 */
export function ButtonView(bindings: ButtonViewBindings): Container {
    const view = new Container();

    // Drawn white once, and tinted to show whether it's enabled
    const background = new Graphics().roundRect(0, 0, WIDTH, HEIGHT, 8).fill(0xffffff);
    const text = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffffff } });
    text.anchor.set(0.5, 0.5);
    text.position.set(WIDTH / 2, HEIGHT / 2);
    view.addChild(background, text);

    view.eventMode = 'static';
    view.on('pointertap', () => {
        if (bindings.isEnabled()) bindings.onClicked?.();
    });

    function refresh(): void {
        text.text = bindings.label();
        const isEnabled = bindings.isEnabled();
        background.tint = isEnabled ? 0x2f6f5a : 0x262c3a;
        text.alpha = isEnabled ? 1 : 0.35;
        view.cursor = isEnabled ? 'pointer' : 'default';
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WIDTH = 140;
const HEIGHT = 44;
