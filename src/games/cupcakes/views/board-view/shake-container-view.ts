import { Container } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShakeContainerViewBindings {
    getMatchSequence(): Sequence<'shake'>;
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
    view.addChild(content);

    const updateShake = createSequenceReaction(bindings.getMatchSequence(), {
        shake: {
            inactive: () => content.position.set(0, 0),
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                const amp = (SHAKE_AMPLITUDE + SHAKE_CASCADE_BONUS * (cascade - 1)) * (1 - progress);
                const p = progress * SHAKE_FREQUENCY;
                content.position.set(
                    Math.sin(p) * amp,
                    Math.cos(p * 0.7) * amp * 0.6,
                );
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
const SHAKE_AMPLITUDE = 3;
/** Extra shake amplitude per additional cascade step. */
const SHAKE_CASCADE_BONUS = 1.5;
/** Speed multiplier for the shake oscillation. */
const SHAKE_FREQUENCY = 40;
