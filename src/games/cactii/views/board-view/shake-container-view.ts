import { Container } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';
import { GRID_COLS, GRID_ROWS } from '../../data';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShakeContainerViewBindings {
    getMatchSequence(): Sequence<'shake' | 'zoom'>;
    getCascadeStep(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * A container that applies a shake displacement to a single inner `content`
 * child. Add anything that should be shaken to `content`, not directly to the
 * returned view.
 *
 * ```ts
 * const shake = createShakeContainerView(bindings);
 * shake.content.addChild(background);
 * shake.content.addChild(pieces);
 * parent.addChild(shake);
 * ```
 */
export function createShakeContainerView(bindings: ShakeContainerViewBindings): Container & { content: Container } {
    const view = new Container();
    const content = new Container();
    const centreX = GRID_COLS * CELL_WIDTH_PX * 0.5;
    const centreY = GRID_ROWS * CELL_HEIGHT_PX * 0.5;
    // Set pivot to board centre so zoom scales symmetrically
    content.pivot.set(centreX, centreY);
    content.position.set(centreX, centreY);
    view.addChild(content);

    const updateShake = createSequenceReaction(bindings.getMatchSequence(), {
        shake: {
            inactive: () => content.position.set(centreX, centreY),
            active: (progress) => {
                const cascadeStep = bindings.getCascadeStep();
                const amp = (SHAKE_AMPLITUDE + SHAKE_CASCADE_BONUS * (cascadeStep - 1)) * (1 - progress);
                const p = progress * SHAKE_FREQUENCY;
                content.position.set(
                    centreX + Math.sin(p) * amp,
                    centreY + Math.cos(p * 0.7) * amp * 0.6,
                );
            },
        },
        zoom: {
            inactive: () => content.scale.set(1),
            active: (progress) => {
                const cascadeStep = bindings.getCascadeStep();
                if (cascadeStep < MIN_CASCADE_STEP_FOR_ZOOM) {
                    content.scale.set(1);
                    return;
                }
                const amp = ZOOM_AMPLITUDE + (cascadeStep - MIN_CASCADE_STEP_FOR_ZOOM) * ZOOM_CASCADE_BONUS;
                // Bell curve: peaks in the middle of the step
                const t = Math.sin(progress * Math.PI);
                content.scale.set(1 + amp * t);
            },
        },
    });

    view.onRender = updateShake;
    return Object.assign(view, { content });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Maximum shake offset in pixels at cascade step 1. */
const SHAKE_AMPLITUDE = 15;
/** Extra shake amplitude per additional cascade step. */
const SHAKE_CASCADE_BONUS = 7.5;
/** Speed multiplier for the shake oscillation. */
const SHAKE_FREQUENCY = 40;

/** Minimum cascade step before zoom activates. */
const MIN_CASCADE_STEP_FOR_ZOOM = 2;
/** Base zoom amplitude (fraction of scale, e.g. 0.02 = 2%). */
const ZOOM_AMPLITUDE = 0.02;
/** Extra zoom amplitude per cascade step above the minimum. */
const ZOOM_CASCADE_BONUS = 0.01;
