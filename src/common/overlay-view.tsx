/** @jsxImportSource #pixi-mvt/jsx */

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
    const { width, height, onRestartPressed } = bindings;
    const style = { ...LABEL_STYLE, fontSize: Math.round(width * 0.05) };

    // Presentation state: a release waiting to be relayed. A model sees a
    // press only by polling in its update, so a tap whose press and release
    // both arrive between two updates would be missed. The release is held
    // back until this view's update, which runs after the model's in the same
    // frame, so the model always sees the press first.
    let isReleasePending = false;

    return (
        <container label="overlay" visible={bindings.isVisible} onUpdate={relayPendingRelease}>
            <graphics ref={(g) => drawBackdrop(g, width, height)} {...pressHandlers()} />
            <text text={bindings.text} anchor={0.5} x={width / 2} y={height / 2} style={style} />
        </container>
    );

    /** The backdrop's pointer handlers: none, so it is not interactive, without a relay binding to call. */
    function pressHandlers(): PressHandlers {
        if (onRestartPressed === undefined) return {};
        const release = (): void => {
            isReleasePending = true;
        };
        return {
            cursor: 'pointer',
            onPointerDown: () => {
                isReleasePending = false;
                onRestartPressed(true);
            },
            onPointerUp: release,
            onPointerUpOutside: release,
            onPointerCancel: release,
        };
    }

    function relayPendingRelease(): void {
        if (!isReleasePending) return;
        isReleasePending = false;
        onRestartPressed?.(false);
    }
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
