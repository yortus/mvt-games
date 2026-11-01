import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { Sequence } from '@mvtjs/utils';
import { BOARD_X, BOARD_Y, CELL_PX } from './board-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlashOverlayViewBindings {
    /** The board's match sequence. The view reads it once. */
    readonly matchSequence: Sequence<'flash'>;
    /** The board's size, read once. */
    readonly rows: number;
    readonly cols: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A bright overlay on the board that fades out over the sequence's flash step. */
export function FlashOverlayView(bindings: FlashOverlayViewBindings): Container {
    const { matchSequence } = bindings;
    const view = new Container();
    const overlay = new Graphics();
    overlay.roundRect(BOARD_X, BOARD_Y, bindings.cols * CELL_PX, bindings.rows * CELL_PX, 12).fill(0xffffff);
    view.addChild(overlay);

    setRefresh(view, () => {
        const { flash } = matchSequence.steps;
        overlay.visible = flash.isActive;
        overlay.alpha = 1 - flash.progress;
    });
    return view;
}
