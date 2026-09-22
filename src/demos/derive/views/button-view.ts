import { Container, Graphics, Text } from 'pixi.js';
import {
    FONT,
    LABEL_SIZE,
    TEXT_MAIN,
    TEXT_RESOLUTION,
    BUTTON_BG,
    BUTTON_BG_HOVER,
    BUTTON_BG_ACTIVE,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** Bindings for a simple clickable button. */
export interface ButtonViewBindings {
    /** Current button label. */
    getLabel(): string;
    /** Called when the button is pressed. */
    onPress(): void;
    /** Optional: whether the button is in an active/toggled-on state. */
    getActive?(): boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ButtonViewOptions extends ButtonViewBindings {
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createButtonView(options: ButtonViewOptions): Container {
    const { width, height, getLabel, onPress, getActive } = options;

    const view = new Container();
    view.eventMode = 'static';
    view.cursor = 'pointer';

    const bg = new Graphics();
    const label = new Text({
        text: getLabel(),
        resolution: TEXT_RESOLUTION,
        style: { fontFamily: FONT, fontSize: LABEL_SIZE, fill: TEXT_MAIN },
    });
    label.anchor.set(0.5);
    label.position.set(width / 2, height / 2);
    view.addChild(bg, label);

    let hovered = false;
    let prevLabel = '';
    let prevFill = -1;

    view.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height };
    view.on('pointerover', () => {
        hovered = true;
    });
    view.on('pointerout', () => {
        hovered = false;
    });
    view.on('pointerdown', () => {
        onPress();
    });

    view.onRender = refresh;
    return view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const active = getActive?.() ?? false;
        const fill = active ? BUTTON_BG_ACTIVE : hovered ? BUTTON_BG_HOVER : BUTTON_BG;
        if (fill !== prevFill) {
            prevFill = fill;
            bg.clear();
            bg.roundRect(0, 0, width, height, 6).fill({ color: fill });
        }

        const text = getLabel();
        if (text !== prevLabel) {
            prevLabel = text;
            label.text = text;
        }
    }
}
