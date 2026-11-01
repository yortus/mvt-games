import { Container, Graphics, Text } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    /** The words on the button. */
    readonly label: string;
    /** The button's width, in pixels. */
    readonly width: number;
    /** Called when the player presses the button. */
    readonly onPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button to click or tap. It's drawn once, and has nothing to refresh. */
export function ButtonView({ label, width, onPressed }: ButtonViewBindings): Container {
    const view = new Container();
    const back = new Graphics()
        .roundRect(0, 0, width, HEIGHT, CORNER)
        .fill(0x24344d)
        .stroke({ color: 0x5577aa, width: 1.5 });
    const text = new Text({
        text: label,
        style: { fontFamily: 'monospace', fontSize: 15, fill: 0xe0e8f0 },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(width / 2, HEIGHT / 2);
    view.addChild(back, text);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.on('pointerdown', () => onPressed());
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HEIGHT = 34;
const CORNER = 6;
