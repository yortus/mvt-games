/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi';
import { ACCENT_COLOR, CARD_COLOR, INK_COLOR, LABEL_STYLE, THIN_LINE_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonViewBindings {
    /** Where its top left corner is, and its size, read once. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** What it says, which can change. */
    label: ValueOrGetter<string>;
    /** The label's size, in pixels, read once. Defaults to the labels' usual size. */
    labelSize?: number;
    /** Whether what it chose is in force, which fills it in. Unlit if left out. */
    isLit?: ValueOrGetter<boolean>;
    /** Whether it can be pressed. One that can't is faded, and takes no presses. Enabled if left out. */
    isEnabled?: ValueOrGetter<boolean>;
    onPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A button: a card with a label, filled in with blue while what it chose is in force. */
export function ButtonView(bindings: ButtonViewBindings): Container {
    const { width, height } = bindings;
    const isLit = toGetter(bindings.isLit ?? false);
    const isEnabled = toGetter(bindings.isEnabled ?? true);
    const style = bindings.labelSize === undefined ? LABEL_STYLE : { ...LABEL_STYLE, fontSize: bindings.labelSize };
    const press = (): void => {
        if (isEnabled()) bindings.onPressed();
    };
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            cursor="pointer"
            alpha={() => (isEnabled() ? 1 : DISABLED_ALPHA)}
            onPointerTap={press}
        >
            <graphics ref={(g) => g.roundRect(0, 0, width, height, 10).fill(0xffffff)} tint={CARD_COLOR} />
            <graphics
                ref={(g) => g.roundRect(0, 0, width, height, 10).stroke({ color: 0xffffff, width: 1.5 })}
                tint={() => (isLit() ? ACCENT_COLOR : THIN_LINE_COLOR)}
            />
            <graphics ref={(g) => g.roundRect(0, 0, width, height, 10).fill(0xffffff)} tint={ACCENT_COLOR} visible={isLit} />
            <text
                text={bindings.label}
                x={width / 2}
                y={height / 2}
                anchor={0.5}
                style={style}
                tint={() => (isLit() ? 0xffffff : INK_COLOR)}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DISABLED_ALPHA = 0.4;

/** A getter for `value`: itself, if it is one already. */
function toGetter(value: ValueOrGetter<boolean>): () => boolean {
    return typeof value === 'function' ? value : () => value;
}
