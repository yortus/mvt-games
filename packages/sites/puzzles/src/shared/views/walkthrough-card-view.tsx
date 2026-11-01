/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { ButtonView } from './button-view';
import {
    ACCENT_COLOR, CARD_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, MARGIN, NUMBER_TEXTS, PAGE_WIDTH, WALKTHROUGH_HEIGHT, WALKTHROUGH_Y,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WalkthroughCardViewBindings {
    /** Which step the walkthrough is at, from 1, and how many there are. */
    stepNumber: () => number;
    stepCount: () => number;
    /** What the step asks, which an arrow shows. */
    text: () => string;
    /** Whether it is the last step, which asks nothing, so the way to skip becomes the way to play. */
    isAtLastStep: () => boolean;
    /** The player skipped the walkthrough, or finished it, at its last step. */
    onEnded: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The walkthrough's card, across the top of the screen: what to do next,
 * which an arrow shows, which step it is, and a way to skip the rest, which
 * becomes the way to start playing at the last step. It is laid out in the
 * screen's pixels, the same in every game.
 */
export function WalkthroughCardView(bindings: WalkthroughCardViewBindings): Container {
    const stepText = createComputed({
        watch: { number: bindings.stepNumber, count: bindings.stepCount },
        compute: ({ number, count }) => `How to play: step ${NUMBER_TEXTS[number]} of ${NUMBER_TEXTS[count]}`,
    });
    return (
        <container x={MARGIN} y={WALKTHROUGH_Y}>
            <graphics ref={(g) => g.roundRect(2, 4, PAGE_WIDTH, WALKTHROUGH_HEIGHT, 12).fill({ color: INK_COLOR, alpha: 0.18 })} />
            <graphics ref={(g) => g.roundRect(0, 0, PAGE_WIDTH, WALKTHROUGH_HEIGHT, 12).fill(CARD_COLOR).stroke({ color: ACCENT_COLOR, width: 2 })} />
            <text text={stepText} x={PADDING} y={PADDING} style={STEP_STYLE} tint={DIM_TEXT_COLOR} />
            <text text={bindings.text} x={PADDING} y={PADDING + 18} style={TEXT_STYLE} tint={INK_COLOR} />
            <ButtonView
                x={PAGE_WIDTH - PADDING - BUTTON_WIDTH}
                y={(WALKTHROUGH_HEIGHT - BUTTON_HEIGHT) / 2}
                width={BUTTON_WIDTH}
                height={BUTTON_HEIGHT}
                label={() => (bindings.isAtLastStep() ? 'Play' : 'Skip')}
                isLit={bindings.isAtLastStep}
                onPressed={bindings.onEnded}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PADDING = 10;
const BUTTON_WIDTH = 84;
const BUTTON_HEIGHT = 40;

const STEP_STYLE = { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '600', fill: 0xffffff };
const TEXT_STYLE = {
    fontFamily: FONT_FAMILY, fontSize: 14, fill: 0xffffff, wordWrap: true, wordWrapWidth: PAGE_WIDTH - PADDING * 3 - BUTTON_WIDTH, lineHeight: 17,
};
