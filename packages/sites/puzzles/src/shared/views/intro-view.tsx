/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { Demo, HowToPlayText, IntroModel } from '../models';
import { HowToPlayCardView } from './how-to-play-card-view';
import type { ScreenPoint } from './pointer-view-model';
import { PointerView } from './pointer-view';
import { WalkthroughCardView } from './walkthrough-card-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface IntroViewBindings<P, T> {
    /** The way in it shows. */
    intro: IntroModel<P, T>;
    /** The game's small example, for the card, and how to play it, read once. */
    example: Container;
    text: HowToPlayText;
    /** Where a demo's target is, in the screen's pixels, for the arrow. */
    findPoint: (target: T) => ScreenPoint;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The way in, over a puzzle's screen, the same in every game: the card that
 * says how to play, or the walkthrough's card across the top, with an arrow
 * that shows each step on the practice puzzle beneath. It goes last in the
 * puzzle's screen, over everything else. It is laid out in the screen's
 * pixels.
 */
export function IntroView<P, T>(bindings: IntroViewBindings<P, T>): Container {
    const { intro } = bindings;
    const walkthrough = () => intro.walkthrough;
    return (
        <container>
            <container visible={() => intro.phase === 'walkthrough'}>
                <PointerView demo={() => walkthrough()?.demo ?? NO_DEMO} demosShown={() => walkthrough()?.demosShown ?? 0} findPoint={bindings.findPoint} />
                <WalkthroughCardView
                    stepNumber={() => walkthrough()?.stepNumber ?? 1}
                    stepCount={() => walkthrough()?.stepCount ?? 1}
                    text={() => walkthrough()?.text ?? ''}
                    isAtLastStep={() => walkthrough()?.isAtLastStep ?? false}
                    onEnded={intro.close}
                />
            </container>
            <container visible={() => intro.phase === 'card'}>
                <HowToPlayCardView example={bindings.example} text={bindings.text} onShowMePressed={intro.startWalkthrough} onPlayPressed={intro.close} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** No demo, while the walkthrough isn't playing. */
const NO_DEMO: Demo<never> = [];
