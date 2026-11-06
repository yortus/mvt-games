/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { ACCENT_COLOR, ButtonView, HOLD_RING_RADIUS, HoldRingView } from '../../../shared';
import { hasDigit } from '../generator';
import { createKeypadGesturesViewModel } from './keypad-gestures-view-model';
import { findKeyLeft } from './puzzle-layout';
import { KEY_HEIGHT, KEY_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface KeypadViewBindings {
    /** The digits of the cells selected, lit, as a set: bit `d` is set for each digit `d`. */
    digits: () => number;
    /** Whether the keys take presses. If not, they are faded. */
    isEnabled: () => boolean;
    /** Whether holding a key fills a cell with its digit, as it does while one cell is selected. */
    canFill: () => boolean;
    /** The player tapped the key for `digit`. */
    onTapped: (digit: number) => void;
    /** The player pressed the key for `digit`, and held it, while holding could fill a cell. */
    onHeld: (digit: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A row of keys for the digits 1 to 9. Each digit the cells selected hold is
 * lit. A tap on a key notes its digit. Pressed and held while one cell is
 * selected, a key fills the cell with its digit instead, or clears it if
 * the digit is there. While it is held, a ring fills round its digit, as in
 * the walkthrough's demo: blue, or white on a key lit in blue, which is the
 * one that clears. What the presses mean is the gestures view model's. Its
 * origin is its top left corner.
 */
export function KeypadView(bindings: KeypadViewBindings): Container {
    const gestures = createKeypadGesturesViewModel({
        isEnabled: bindings.isEnabled,
        canFill: bindings.canFill,
        onTapped: bindings.onTapped,
        onHeld: bindings.onHeld,
    });

    const keys: Container[] = [];
    for (let digit = 1; digit <= 9; digit++) {
        keys.push(
            <container
                x={findKeyLeft(digit)}
                y={0}
                onPointerDown={() => gestures.press(digit)}
                onPointerUp={() => gestures.release(digit)}
                onPointerUpOutside={gestures.cancel}
                onPointerCancel={gestures.cancel}
            >
                <ButtonView
                    x={0}
                    y={0}
                    width={KEY_WIDTH}
                    height={KEY_HEIGHT}
                    label={String(digit)}
                    labelSize={24}
                    isLit={() => hasDigit(bindings.digits(), digit)}
                    isEnabled={bindings.isEnabled}
                    onPressed={() => undefined}
                />
                <container x={KEY_WIDTH / 2} y={KEY_HEIGHT / 2}>
                    <HoldRingView
                        radius={HOLD_RING_RADIUS}
                        progress={() => gestures.holdProgressFor(digit)}
                        color={() => (hasDigit(bindings.digits(), digit) ? 0xffffff : ACCENT_COLOR)}
                    />
                </container>
            </container>,
        );
    }
    const view = <container>{keys}</container>;
    setUpdate(view, gestures.update);
    return view;
}
