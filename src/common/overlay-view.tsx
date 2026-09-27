/** @jsxImportSource #pixi-jsx */

import type { Container, Cursor, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OverlayViewBindings {
    /** The overlay's size, which sizes its backdrop and text, so read once. */
    width: number;
    height: number;
    isVisible: () => boolean;
    text: () => string;
    /** The overlay was pressed (`true`) or released (`false`), e.g. to restart. */
    onRestartPressed?: (pressed: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A dimmed panel over the play area with a centred message, such as "GAME
 * OVER". Pressable when it has an `onRestartPressed` relay binding.
 */
export function OverlayView(bindings: OverlayViewBindings): Container {
    const { width, height } = bindings;
    const style = { ...LABEL_STYLE, fontSize: Math.round(width * 0.05) };

    return (
        <container label="overlay" visible={bindings.isVisible}>
            <graphics
                ref={(g) => drawBackdrop(g, width, height)}
                {...pressHandlers(bindings.onRestartPressed)}
            />
            <text text={bindings.text} anchor={0.5} x={width / 2} y={height / 2} style={style} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const LABEL_STYLE = { fontFamily: 'monospace', fill: 0xffffff, align: 'center' };

function drawBackdrop(g: Graphics, width: number, height: number): void {
    g.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.6 });
}

interface PressHandlers {
    cursor?: Cursor;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    onPointerUpOutside?: () => void;
    onPointerCancel?: () => void;
}

/** The backdrop's pointer handlers: none, so it is not interactive, without a relay binding to call. */
function pressHandlers(onRestartPressed: ((pressed: boolean) => void) | undefined): PressHandlers {
    if (onRestartPressed === undefined) return {};
    const delayedRelease = (): void => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                onRestartPressed(false);
            });
        });
    };
    return {
        cursor: 'pointer',
        onPointerDown: () => onRestartPressed(true),
        onPointerUp: delayedRelease,
        onPointerUpOutside: delayedRelease,
        onPointerCancel: delayedRelease,
    };
}
