/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { TutorialStep } from '../models';
import { ButtonView } from './button-view';
import { ACCENT_COLOR, BOX_LINE_COLOR, CARD_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, GRID_SIZE, INK_COLOR, MARGIN, NUMBER_TEXTS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TutorialViewBindings {
    /** The step the tutorial is at, or undefined while it isn't playing. */
    step: () => TutorialStep | undefined;
    /** Which step it is, from 1. */
    stepNumber: () => number;
    /** How many steps there are, read once. */
    stepCount: number;
    /** The digit the fill step's demo fills in, which its text names. */
    fillDigit: () => number;
    /** The player skipped the tutorial, or finished it, at its last step. */
    onEnded: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The tutorial's card, over the top of the puzzle's screen: what to do
 * next, which an arrow shows, which step it is, and a way to skip the
 * rest, which becomes the way to start playing at the last step. It is laid
 * out in the screen's pixels.
 */
export function TutorialView(bindings: TutorialViewBindings): Container {
    const isShown = (): boolean => bindings.step() !== undefined;
    const isLastStep = (): boolean => bindings.step() === 'done';
    const stepText = createComputed({
        watch: bindings.stepNumber,
        compute: (number) => `How to make notes: step ${NUMBER_TEXTS[number]} of ${NUMBER_TEXTS[bindings.stepCount]}`,
    });
    const text = createComputed({
        watch: { step: bindings.step, digit: bindings.fillDigit },
        compute: ({ step, digit }) => (step === 'fill' ? writeFillText(digit) : STEP_TEXTS[step ?? 'done']),
    });

    return (
        <container visible={isShown}>
            <container x={MARGIN} y={CARD_Y}>
                <graphics ref={(g) => g.roundRect(2, 4, CARD_WIDTH, CARD_HEIGHT, 12).fill({ color: BOX_LINE_COLOR, alpha: 0.18 })} />
                <graphics ref={(g) => g.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12).fill(CARD_COLOR).stroke({ color: ACCENT_COLOR, width: 2 })} />
                <text text={stepText} x={PADDING} y={PADDING} style={STEP_STYLE} tint={DIM_TEXT_COLOR} />
                <text text={text} x={PADDING} y={PADDING + 18} style={TEXT_STYLE} tint={INK_COLOR} />
                <ButtonView
                    x={CARD_WIDTH - PADDING - BUTTON_WIDTH}
                    y={(CARD_HEIGHT - BUTTON_HEIGHT) / 2}
                    width={BUTTON_WIDTH}
                    height={BUTTON_HEIGHT}
                    label={() => (isLastStep() ? 'Play' : 'Skip')}
                    isLit={isLastStep}
                    onPressed={bindings.onEnded}
                />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_Y = 4;
const CARD_WIDTH = GRID_SIZE;
const CARD_HEIGHT = 74;
const PADDING = 10;
const BUTTON_WIDTH = 84;
const BUTTON_HEIGHT = 40;

const STEP_STYLE = { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '600', fill: 0xffffff };
const TEXT_STYLE = {
    fontFamily: FONT_FAMILY, fontSize: 14, fill: 0xffffff, wordWrap: true, wordWrapWidth: CARD_WIDTH - PADDING * 3 - BUTTON_WIDTH, lineHeight: 17,
};

/** What each step asks the player to do, as the arrow shows it. The fill step's names its digit. */
const STEP_TEXTS: Readonly<Record<Exclude<TutorialStep, 'fill'>, string>> = {
    select: 'Tap an empty cell to select it. This is a practice puzzle, so try anything you like.',
    mark: 'Tap two digits that could go in the cell, to pencil them in. Tap one again to take it out.',
    link: 'Drag across two empty cells in a row, a column or a box, to link them.',
    group: 'Tap the digits that go in the linked cells, in either order, to note them across both.',
    done: 'Fill in cells when you know them: their notes clear away. Undo takes back anything. Have fun!',
};

function writeFillText(digit: number): string {
    return `Tap a cell, then double-tap its digit to fill it in. Only a ${NUMBER_TEXTS[digit]} can go in this one.`;
}
