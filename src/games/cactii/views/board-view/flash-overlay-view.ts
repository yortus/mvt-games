import { Container, Graphics } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlashOverlayViewBindings {
    getMatchSequence(): Sequence<'flash'>;
    getCascadeStep(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFlashOverlayView(bindings: FlashOverlayViewBindings): Container {
    const view = new Container();

    const flash = new Graphics();
    flash.rect(0, 0, BOARD_WIDTH_PX, BOARD_HEIGHT_PX).fill(0xffffff);
    flash.alpha = 0;
    view.addChild(flash);

    const updateFlash = createSequenceReaction(bindings.getMatchSequence(), {
        flash: {
            inactive: () => { flash.alpha = 0; },
            active: (progress) => {
                const cascadeStep = bindings.getCascadeStep();
                // Peak alpha scales with cascade: 0.15 at cascade 1, up to 0.6 at cascade 4+
                const peakAlpha = Math.min(MAX_FLASH_ALPHA, BASE_FLASH_ALPHA + (cascadeStep - 1) * FLASH_CASCADE_BONUS);
                // Flash peaks at ~30% then fades out
                const t = progress < 0.3 ? progress / 0.3 : (1 - progress) / 0.7;
                flash.alpha = peakAlpha * t;
            },
        },
    });

    view.onRender = updateFlash;
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOARD_WIDTH_PX = GRID_COLS * CELL_WIDTH_PX;
const BOARD_HEIGHT_PX = GRID_ROWS * CELL_HEIGHT_PX;

/** Flash alpha at cascade step 1. */
const BASE_FLASH_ALPHA = 0.15;
/** Extra flash alpha per additional cascade step. */
const FLASH_CASCADE_BONUS = 0.15;
/** Maximum flash alpha regardless of cascade. */
const MAX_FLASH_ALPHA = 0.6;
