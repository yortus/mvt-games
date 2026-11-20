/**
 * These tests check that every puzzle's text fits on the cards that show
 * it. Each step of a puzzle's walkthrough must fit on the walkthrough card,
 * and its rules and controls must fit on the How to play card. Each card is
 * built from the shared views, with the puzzle's own text, and the text is
 * measured as the browser draws it. Measuring text needs a real font, so
 * these tests run here, with the visual tests, rather than as unit tests.
 *
 * The walkthrough card is a fixed height, so a step's text that wraps onto
 * one line too many spills out of it. The How to play card grows to hold
 * its text, but once it's too tall for the screen, it shrinks to fit, and
 * then all of its text is smaller. A visual test shows neither, unless
 * someone poses that step and looks closely. So these tests measure every
 * step of every puzzle, posed or not. Each puzzle's walkthrough card is also
 * drawn at its longest step, the one most likely to spill.
 *
 * A font is drawn a little differently on each platform. The site's font
 * is Segoe UI on Windows and Helvetica Neue on a Mac, so a line that only
 * just fits on one can wrap on the other. So each text is measured as if
 * the room it wraps in were a little narrower than it is.
 *
 * Each puzzle's text is found where every puzzle keeps it. Its walkthrough
 * is exported from its models, and its `HOW_TO_PLAY` from its start files.
 * So a new puzzle is checked as soon as it's added. A step whose text is
 * written from its demo, such as one that names a digit, is written here
 * from an empty demo, so it uses its stand-in for the demo's values.
 */

import { CanvasTextMetrics, Container, Graphics, Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { canvasTest } from 'v-snap';
import { refreshView } from '@mvtjs/pixi';
import {
    HowToPlayCardView, type HowToPlayText, MARGIN, PAPER_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH, WALKTHROUGH_HEIGHT, WALKTHROUGH_Y,
    WalkthroughCardView,
} from '../../shared';

const startModules = import.meta.glob<Record<string, unknown>>('../*/start/index.ts', { eager: true });
const modelModules = import.meta.glob<Record<string, unknown>>('../*/models/index.ts', { eager: true });

for (const puzzle of listPuzzles()) {
    describe(puzzle.name, () => {
        const { steps } = puzzle.walkthrough;

        canvasTest('the walkthrough card, at its longest step', CARD_SIZE, () => poseWalkthroughCard(steps, findLongestStep(steps)));

        it('fits each step\'s text on the walkthrough card', () => {
            const tooLong: string[] = [];
            for (let i = 0; i < steps.length; i++) {
                const card = WalkthroughCardView(toCardBindings(steps, i));
                refreshView(card);
                const text = findText(card, writeStepText(steps[i]));
                const { height, lineCount } = measureNarrowed(text);
                // The text must end above the card's bottom edge by as much as it keeps from the card's left edge
                if (text.y + height > WALKTHROUGH_HEIGHT - text.x) tooLong.push(`step ${i + 1}, on ${lineCount} lines: ${text.text}`);
                card.destroy({ children: true });
            }
            expect(tooLong).toEqual([]);
        });

        it('fits the How to play card on the screen without shrinking it', () => {
            const view = HowToPlayCardView({
                example: new Container(), text: puzzle.howToPlay, onShowMePressed: () => undefined, onPlayPressed: () => undefined,
            });
            // The card is the title's parent, and is scaled down when it's too tall for the screen
            const card = findText(view, 'How to play').parent!;
            expect(card.scale.y).toBe(1);
            // How much taller the card would be if each text wrapped in narrower room
            let extra = 0;
            for (const text of listTexts(card)) {
                if (text.style.wordWrap) extra += measureNarrowed(text).height - text.height;
            }
            expect(card.getLocalBounds().height - BORDER_ALLOWANCE + extra).toBeLessThanOrEqual(SCREEN_HEIGHT - MARGIN * 2);
            view.destroy({ children: true });
        });
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * How much narrower than its room each text is measured, as a share of the
 * room's width, to allow for a platform whose font is a little wider.
 */
const NARROWING = 0.95;

/** How much the How to play card's border adds to its height, since half the border's width is drawn outside the card, at each edge. */
const BORDER_ALLOWANCE = 2;

/** The image of a walkthrough card, which shows the top of the screen, down to just below the card. */
const CARD_SIZE = { width: SCREEN_WIDTH, height: WALKTHROUGH_Y + WALKTHROUGH_HEIGHT + 12, pixelArt: false };

/** What these tests read of a walkthrough, the text of each step, which may be written from the step's demo. */
interface WalkthroughText {
    readonly steps: readonly { readonly text: string | ((demo: readonly never[]) => string) }[];
}

/** A puzzle's folder name, its walkthrough and its How to play text. */
interface PuzzleText {
    readonly name: string;
    readonly walkthrough: WalkthroughText;
    readonly howToPlay: HowToPlayText;
}

/** Every puzzle with both a walkthrough and How to play text, found by the paths every puzzle keeps them at. */
function listPuzzles(): PuzzleText[] {
    const puzzles: PuzzleText[] = [];
    for (const [path, exports] of Object.entries(modelModules)) {
        const name = path.split('/')[1];
        const walkthrough = Object.values(exports).find(isWalkthrough);
        const howToPlay = startModules[`../${name}/start/index.ts`]?.HOW_TO_PLAY as HowToPlayText | undefined;
        if (walkthrough !== undefined && howToPlay !== undefined) puzzles.push({ name, walkthrough, howToPlay });
    }
    return puzzles;
}

function isWalkthrough(value: unknown): value is WalkthroughText {
    if (typeof value !== 'object' || value === null || !('steps' in value) || !Array.isArray(value.steps)) return false;
    return value.steps.every((step: unknown) => typeof step === 'object' && step !== null && 'text' in step && ['string', 'function'].includes(typeof step.text));
}

/** The text of `step`, written from an empty demo if it's written from its demo. */
function writeStepText(step: WalkthroughText['steps'][number]): string {
    return typeof step.text === 'string' ? step.text : step.text([]);
}

/** The place in `steps` of the step with the most text. */
function findLongestStep(steps: WalkthroughText['steps']): number {
    let longest = 0;
    for (let i = 1; i < steps.length; i++) {
        if (writeStepText(steps[i]).length > writeStepText(steps[longest]).length) longest = i;
    }
    return longest;
}

/** The walkthrough card at step `index` of `steps`. */
function toCardBindings(steps: WalkthroughText['steps'], index: number) {
    return {
        stepNumber: () => index + 1,
        stepCount: () => steps.length,
        text: () => writeStepText(steps[index]),
        isAtLastStep: () => index === steps.length - 1,
        onEnded: () => undefined,
    };
}

/** The walkthrough card on paper, at step `index` of `steps`, as it shows at the top of the screen. */
function poseWalkthroughCard(steps: WalkthroughText['steps'], index: number): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, CARD_SIZE.width, CARD_SIZE.height).fill(PAPER_COLOR));
    view.addChild(WalkthroughCardView(toCardBindings(steps, index)));
    return view;
}

/** Measures `text`'s height, and how many lines it wraps onto, as if the room it wraps in were narrowed. */
function measureNarrowed(text: Text): { height: number; lineCount: number } {
    const style = text.style.clone();
    style.wordWrapWidth *= NARROWING;
    const metrics = CanvasTextMetrics.measureText(text.text, style);
    return { height: metrics.height, lineCount: metrics.lines.length };
}

/** The text in `root` that shows `content`. A test that can't find it fails. */
function findText(root: Container, content: string): Text {
    const found = listTexts(root).find((text) => text.text === content);
    if (found === undefined) throw new Error(`Couldn't find a text that shows "${content}"`);
    return found;
}

/** Every text in `root`, however deep. */
function listTexts(root: Container): Text[] {
    const texts: Text[] = [];
    for (const child of root.children) {
        if (child instanceof Text) texts.push(child);
        texts.push(...listTexts(child));
    }
    return texts;
}
