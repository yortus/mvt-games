import { Container, Graphics, GraphicsContext, Text, type TextStyleOptions } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { DIM_TEXT_COLOR, FOCUS_COLOR, GIVEN_COLOR, RUBBED_OUT_COLOR, TEST_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The digits of a cell being dug, as each rival is tried there. A set of digits is a mask with bit `d` set for each digit `d`. */
export interface DigitTrialViewBindings {
    /** The digit the cell held, which is being dug out. */
    ownDigit: () => number;
    /** The other digits that could go in the cell, each to be tried. */
    rivalDigits: () => number;
    /** The rivals tried so far that led nowhere. */
    ruledOutDigits: () => number;
    /** The rival being tried now, or 0. */
    testDigit: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A cell's digits laid out 3 by 3, as the digits that could take its own
 * digit's place are tried. Its own digit is gold, in a ring, as it is the
 * one being dug out. The rivals still to try are bright, the one being
 * tried is orange, and each that leads nowhere fades as a red stroke is
 * drawn through it. Digits that break a rule there are left out. Its origin
 * is the cell's middle.
 */
export function DigitTrialView(bindings: DigitTrialViewBindings): Container {
    const view = new Container();
    view.label = 'digit-trial';
    const ring = new Graphics().circle(0, 0, RING_RADIUS).stroke({ color: FOCUS_COLOR, width: 1.5 });
    view.addChild(ring);
    // Every digit's stroke shares one drawing, released with the view
    const strokeDrawing = new GraphicsContext()
        .moveTo(-STROKE_REACH, STROKE_REACH * 0.8).lineTo(STROKE_REACH, -STROKE_REACH * 0.8)
        .stroke({ color: RUBBED_OUT_COLOR, width: 2, cap: 'round' });
    view.on('destroyed', () => strokeDrawing.destroy());

    const digits: Text[] = [];
    const strokes: Graphics[] = [];
    for (let d = 1; d <= 9; d++) {
        const x = (((d - 1) % 3) - 1) * SPACING;
        const y = (Math.floor((d - 1) / 3) - 1) * SPACING;
        const digit = new Text({ text: String(d), style: DIGIT_STYLE, anchor: 0.5, visible: false });
        digit.position.set(x, y);
        const stroke = new Graphics(strokeDrawing);
        stroke.position.set(x, y);
        stroke.visible = false;
        view.addChild(digit, stroke);
        digits.push(digit);
        strokes.push(stroke);
    }

    // Presentation state: how far each digit's stroke has been drawn, from 0 to 1. A digit already ruled out starts drawn
    const strokeProgress = new Float32Array(10).fill(1);
    const watcher = watch({ ruledOut: bindings.ruledOutDigits });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        const w = watcher.poll();
        if (w.ruledOut.changed) {
            // Each digit newly ruled out starts its stroke from nothing
            const added = w.ruledOut.current & ~(w.ruledOut.previous ?? 0);
            for (let d = 1; d <= 9; d++) {
                if ((added & (1 << d)) !== 0) strokeProgress[d] = 0;
            }
        }
        for (let d = 1; d <= 9; d++) strokeProgress[d] = Math.min(1, strokeProgress[d] + deltaMs / STROKE_MS);
    }

    function refresh(): void {
        const own = bindings.ownDigit();
        const rivals = bindings.rivalDigits();
        const ruledOut = bindings.ruledOutDigits();
        const testDigit = bindings.testDigit();
        for (let d = 1; d <= 9; d++) {
            const bit = 1 << d;
            const digit = digits[d - 1];
            const stroke = strokes[d - 1];
            const isOwn = d === own;
            const isRuledOut = (ruledOut & bit) !== 0;
            const isTried = d === testDigit && !isRuledOut;
            digit.visible = isOwn || (rivals & bit) !== 0;
            digit.tint = isOwn ? FOCUS_COLOR : isTried ? TEST_COLOR : isRuledOut ? DIM_TEXT_COLOR : GIVEN_COLOR;
            digit.scale.set(isTried ? TRIED_SCALE : 1);
            stroke.visible = isRuledOut;
            stroke.scale.set(strokeProgress[d]);
            if (isOwn) ring.position.set(digit.x, digit.y);
        }
        ring.visible = own !== 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart the digits are, in pixels. */
const SPACING = 13;
const RING_RADIUS = 7.5;
/** How far a stroke reaches from a digit's middle, across, in pixels, and how long it takes to draw, in ms. */
const STROKE_REACH = 6;
const STROKE_MS = 160;
/** How much larger the digit being tried is. */
const TRIED_SCALE = 1.25;

const DIGIT_STYLE: TextStyleOptions = { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: 0xffffff };
