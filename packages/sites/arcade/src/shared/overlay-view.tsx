/** @jsxImportSource @mvtjs/pixi */

import type { Container, Cursor, Graphics } from 'pixi.js';
import { PixelTextView } from './pixel-text-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OverlayViewBindings {
    /** The overlay's size, which sizes its backdrop and text, so read once. */
    width: number;
    height: number;
    isVisible: () => boolean;
    text: () => string;
    /**
     * What the text is set in: the system's monospace font, or the site's
     * pixel glyphs, in capitals, for an entry whose own text is set in them.
     * Read once. Defaults to `'system'`.
     */
    font?: 'system' | 'pixel';
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
            {createMessage()}
        </container>
    );

    /** The message, in the font the entry asked for. */
    function createMessage(): Container {
        if (bindings.font !== 'pixel') return <text text={bindings.text} anchor={0.5} x={width / 2} y={height / 2} style={style} />;
        return (
            <container x={width / 2} y={Math.round(height / 2)}>
                <PixelTextView
                    text={bindings.text}
                    color={TEXT_COLOR}
                    scale={Math.max(1, Math.round(width / PIXELS_A_GLYPH_SCALE))}
                    maxWidth={width * MAX_TEXT_SHARE}
                    anchorX={0.5}
                    anchorY={0.5}
                />
            </container>
        );
    }

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

const TEXT_COLOR = 0xffffff;
const LABEL_STYLE = { fontFamily: 'monospace', fill: TEXT_COLOR, align: 'center' };

/**
 * How wide the overlay is for each step up in the pixel glyphs' scale, so
 * their capitals are about as tall as the system font's, whose size is a
 * twentieth of the width.
 */
const PIXELS_A_GLYPH_SCALE = 200;
/** The most of the overlay's width the pixel text may take. */
const MAX_TEXT_SHARE = 0.9;

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
