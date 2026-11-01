/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { ACCENT_COLOR, ButtonView, HOLD_RING_RADIUS, HoldRingView } from '../../../shared';
import { hasDigit } from '../generator';
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
 * one that clears. Its origin is its top left corner.
 */
export function KeypadView(bindings: KeypadViewBindings): Container {
    // Presentation state: the key held down, if any, for how long, and whether its hold has filled a cell
    let heldDigit = 0;
    let heldMs = 0;
    let isHoldDone = false;

    const keys: Container[] = [];
    for (let digit = 1; digit <= 9; digit++) {
        keys.push(
            <container
                x={findKeyLeft(digit)}
                y={0}
                onPointerDown={() => press(digit)}
                onPointerUp={() => release(digit)}
                onPointerUpOutside={cancel}
                onPointerCancel={cancel}
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
                        progress={() => (heldDigit === digit ? findHoldProgress() : 0)}
                        color={() => (hasDigit(bindings.digits(), digit) ? 0xffffff : ACCENT_COLOR)}
                    />
                </container>
            </container>,
        );
    }
    const view = <container>{keys}</container>;
    setUpdate(view, update);
    return view;

    function press(digit: number): void {
        if (!bindings.isEnabled()) return;
        heldDigit = digit;
        heldMs = 0;
        isHoldDone = false;
    }

    /** A key let go: a tap, unless it was held long enough to fill a cell. */
    function release(digit: number): void {
        const isTap = heldDigit === digit && !isHoldDone;
        cancel();
        if (isTap) bindings.onTapped(digit);
    }

    function cancel(): void {
        heldDigit = 0;
        isHoldDone = false;
    }

    function update(deltaMs: number): void {
        if (heldDigit === 0 || isHoldDone) return;
        heldMs += deltaMs;
        if (heldMs < HOLD_MS || !bindings.canFill()) return;
        isHoldDone = true;
        bindings.onHeld(heldDigit);
    }

    /** How far through the hold the key held is, from 0 to 1. It shows nothing for a moment, so a tap shows no ring. */
    function findHoldProgress(): number {
        if (isHoldDone || !bindings.canFill()) return isHoldDone ? 1 : 0;
        return Math.max(0, Math.min(1, (heldMs - QUIET_MS) / (HOLD_MS - QUIET_MS)));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a key must be held to fill a cell, and how long before its ring starts to show, in ms. */
const HOLD_MS = 450;
const QUIET_MS = 100;
