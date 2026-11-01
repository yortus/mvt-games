import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    /** The words on the button. */
    readonly label: () => string;
    /** Whether the button is lit, for the choice that's in use. */
    readonly isSelected: () => boolean;
    /** The button's width, in pixels. */
    readonly width: number;
    /** Called when the player presses the button. */
    readonly onPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button to click or tap, lit while its choice is in use. */
export function ButtonView(bindings: ButtonViewBindings): Container {
    const { width, onPressed } = bindings;
    const view = new Container();
    // Drawn white once, and tinted each refresh
    const back = new Graphics()
        .roundRect(0, 0, width, HEIGHT, CORNER)
        .fill(0xffffff)
        .stroke({ color: 0x5577aa, width: 1.5 });
    const text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 15, fill: 0xe0e8f0 },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(width / 2, HEIGHT / 2);
    view.addChild(back, text);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.on('pointerdown', () => onPressed());

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        text.text = bindings.label();
        back.tint = bindings.isSelected() ? 0x2a6fdb : 0x24344d;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEIGHT = 34;
const CORNER = 6;
