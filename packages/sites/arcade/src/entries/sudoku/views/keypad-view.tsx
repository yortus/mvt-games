/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { hasDigit } from '#sudoku-digger';
import { ButtonView } from './button-view';
import { createDoubleTapTracker } from './double-tap-tracker';
import { findKeyLeft } from './puzzle-layout';
import { KEY_HEIGHT, KEY_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeypadViewBindings {
    /** The digits noted for the cells selected, lit, as a set: bit `d` is set for each digit `d`. */
    digits: () => number;
    /** Whether notes can be made for the cells selected. If not, the keys are faded and take no presses. */
    isEnabled: () => boolean;
    /** Whether a double tap on a key fills a cell with its digit, as it does while one cell is selected. */
    canFill: () => boolean;
    /** A count that rises with every action finished, so the keypad can tell whether a tap's note is still the last one made. */
    changes: () => number;
    /** The player pressed the key for `digit`. */
    onPressed: (digit: number) => void;
    /** The player tapped the key for `digit` twice, quickly, while a double tap could fill a cell. */
    onDoubleTapped: (digit: number) => void;
    /** The note that the double tap's first tap made is to go, since the taps meant something else. It was the last action. */
    onTapTakenBack: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A row of keys for the digits 1 to 9, for noting digits in the cells
 * selected. Each digit noted is lit. Tapping a key twice, quickly, while one
 * cell is selected, fills the cell with its digit instead, and takes back
 * the note the first tap made. Its origin is its top left corner.
 */
export function KeypadView(bindings: KeypadViewBindings): Container {
    // Presentation state: the last key tapped, the count of changes just after it, and whether it made a note
    const taps = createDoubleTapTracker();
    let lastChanges = 0;
    let didLastNote = false;

    const keys: Container[] = [];
    for (let digit = 1; digit <= 9; digit++) {
        keys.push(
            <ButtonView
                x={findKeyLeft(digit)}
                y={0}
                width={KEY_WIDTH}
                height={KEY_HEIGHT}
                label={String(digit)}
                labelSize={24}
                isLit={() => hasDigit(bindings.digits(), digit)}
                isEnabled={bindings.isEnabled}
                onPressed={() => press(digit)}
            />,
        );
    }
    const view = <container>{keys}</container>;
    setUpdate(view, taps.update);
    return view;

    function press(digit: number): void {
        if (taps.isSecondTap(digit) && bindings.canFill()) {
            taps.forget();
            if (didLastNote && bindings.changes() === lastChanges) bindings.onTapTakenBack();
            bindings.onDoubleTapped(digit);
            return;
        }
        const changesBefore = bindings.changes();
        bindings.onPressed(digit);
        taps.noteTap(digit);
        lastChanges = bindings.changes();
        didLastNote = lastChanges > changesBefore;
    }
}
