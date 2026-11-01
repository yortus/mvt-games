import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { HowToPlayText } from '../models';
import { ButtonView } from './button-view';
import {
    CARD_COLOR, DIM_TEXT_COLOR, EXAMPLE_SIZE, FONT_FAMILY, INK_COLOR, MARGIN, PAGE_WIDTH, PAPER_COLOR, SCREEN_HEIGHT,
    SCREEN_WIDTH, THIN_LINE_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HowToPlayCardViewBindings {
    /** A small example of the game, drawn by its own views to fit a square of `EXAMPLE_SIZE`, read once. It takes no input. */
    example: Container;
    /** The rules and the controls, read once. Each control shows as what it does, then its note. */
    text: HowToPlayText;
    /** The player asked to be shown how, in the walkthrough. */
    onShowMePressed: () => void;
    /** The player is ready to play. */
    onPlayPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * How to play, on a card over the screen, the same in every game: a small
 * example at the top, then the rules, then the controls, and the ways on,
 * to be shown how or to play. The screen behind is faded, and takes no
 * taps while the card shows. It is laid out in the screen's pixels.
 */
export function HowToPlayCardView(bindings: HowToPlayCardViewBindings): Container {
    const view = new Container();
    view.label = 'how-to-play';
    const veil = new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill({ color: PAPER_COLOR, alpha: 0.85 });
    veil.eventMode = 'static';
    veil.hitArea = new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const title = new Text({ text: 'How to play', style: TITLE_STYLE });
    title.anchor.set(0.5);
    title.position.set(PAGE_WIDTH / 2, 34);
    title.tint = INK_COLOR;

    const example = new Container({ x: (PAGE_WIDTH - EXAMPLE_SIZE) / 2, y: EXAMPLE_Y });
    example.interactiveChildren = false;
    example.addChild(bindings.example);

    // The rules, then the controls under them, as a table: what each does, and how
    const textWidth = PAGE_WIDTH - PADDING * 2;
    const rules = new Text({ text: bindings.text.rules.join('\n\n'), style: { ...BODY_STYLE, wordWrapWidth: textWidth } });
    rules.position.set(PADDING, EXAMPLE_Y + EXAMPLE_SIZE + GAP);
    rules.tint = INK_COLOR;
    const controls = new Container({ x: PADDING, y: rules.y + rules.height + GAP });
    let rowY = 0;
    for (const control of bindings.text.controls) {
        const action = new Text({ text: control.action, style: { ...ACTION_STYLE, wordWrapWidth: ACTION_WIDTH - COLUMN_GAP } });
        action.position.set(0, rowY);
        action.tint = INK_COLOR;
        const note = new Text({ text: control.note ?? '', style: { ...NOTE_STYLE, wordWrapWidth: textWidth - ACTION_WIDTH } });
        note.position.set(ACTION_WIDTH, rowY);
        note.tint = DIM_TEXT_COLOR;
        controls.addChild(action, note);
        rowY += Math.max(action.height, note.height) + ROW_GAP;
    }

    // The buttons go under the controls, and the card is as tall as all it holds, in the middle of the screen
    const buttonY = controls.y + rowY + GAP;
    const height = buttonY + BUTTON_HEIGHT + PADDING;
    const card = new Container({ x: MARGIN, y: Math.max(MARGIN, (SCREEN_HEIGHT - height) / 2) });
    card.addChild(new Graphics().roundRect(0, 0, PAGE_WIDTH, height, 14).fill(CARD_COLOR).stroke({ color: THIN_LINE_COLOR, width: 1.5 }));
    const showMe = ButtonView({
        x: PAGE_WIDTH / 2 - BUTTON_GAP / 2 - BUTTON_WIDTH, y: buttonY, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, label: 'Show me',
        onPressed: bindings.onShowMePressed,
    });
    const play = ButtonView({
        x: PAGE_WIDTH / 2 + BUTTON_GAP / 2, y: buttonY, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, label: 'Play', isLit: true,
        onPressed: bindings.onPlayPressed,
    });
    card.addChild(title, example, rules, controls, showMe, play);
    view.addChild(veil, card);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The card's inner margin, where its example starts, and the gap between its parts. */
const PADDING = 26;
const EXAMPLE_Y = 58;
const GAP = 16;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 48;
const BUTTON_GAP = 16;
/** The controls' table: the width of the column of what each does, the gap after it, and the gap between rows. */
const ACTION_WIDTH = 132;
const COLUMN_GAP = 10;
const ROW_GAP = 5;

const TITLE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: '700', fill: 0xffffff } as const;
const BODY_STYLE = { fontFamily: FONT_FAMILY, fontSize: 16, lineHeight: 22, fill: 0xffffff, wordWrap: true };
const ACTION_STYLE = { fontFamily: FONT_FAMILY, fontSize: 15, lineHeight: 20, fontWeight: '600', fill: 0xffffff, wordWrap: true } as const;
const NOTE_STYLE = { fontFamily: FONT_FAMILY, fontSize: 15, lineHeight: 20, fill: 0xffffff, wordWrap: true };
