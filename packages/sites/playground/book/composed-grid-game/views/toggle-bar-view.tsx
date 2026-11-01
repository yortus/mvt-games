/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Rectangle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ToggleBarViewBindings {
    /** The name on each button, from the top, read once. The first is button 1. */
    readonly labels: readonly string[];
    /** Whether a button is on. */
    readonly isOnAt: (index: number) => boolean;
    /** Reports a button clicked, or its number key pressed. */
    readonly onToggled?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A column of numbered buttons, one for each label. Each shows whether it's
 * on, and clicking it, or pressing its number key, reports it. The bar
 * doesn't know what a button does: whoever wires it decides that.
 */
export function ToggleBarView(bindings: ToggleBarViewBindings): Container {
    const { labels } = bindings;
    const buttons: Container[] = [];
    for (let i = 0; i < labels.length; i++) {
        const isOn = (): boolean => bindings.isOnAt(i);
        buttons.push(
            <container
                y={i * BUTTON_SPACING}
                cursor="pointer"
                hitArea={new Rectangle(0, 0, BUTTON_W, BUTTON_H)}
                onPointerTap={() => bindings.onToggled?.(i)}
            >
                <graphics ref={drawOnFace} visible={isOn} />
                <graphics ref={drawOffFace} visible={() => !isOn()} />
                <text
                    text={`${i + 1} ${labels[i]}`}
                    x={5}
                    y={BUTTON_H / 2}
                    anchorY={0.5}
                    alpha={() => (isOn() ? 1 : 0.45)}
                    style={LABEL_STYLE}
                />
            </container>,
        );
    }

    window.addEventListener('keydown', onKeyDown);
    return (
        <container onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            {buttons}
        </container>
    );

    function onKeyDown(e: KeyboardEvent): void {
        if (e.repeat) return;
        const index = NUMBER_KEYS.indexOf(e.key);
        if (index < 0 || index >= labels.length) return;
        bindings.onToggled?.(index);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BUTTON_W = 88;
const BUTTON_H = 24;
/** How far apart the buttons' tops are, in pixels. */
const BUTTON_SPACING = 30;
const NUMBER_KEYS = '123456789';
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 10, fill: 0xe8ecff } as const;

function drawOnFace(g: Graphics): void {
    g.roundRect(0, 0, BUTTON_W, BUTTON_H, 5).fill(0x2c4590).stroke({ color: 0x6f8cf0, width: 1.5 });
}

function drawOffFace(g: Graphics): void {
    g.roundRect(0, 0, BUTTON_W, BUTTON_H, 5).stroke({ color: 0x34406a, width: 1.5 });
}
