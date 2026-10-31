/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { ButtonView } from './button-view';
import { findCellMiddleX, findCellTop } from './puzzle-layout';
import { BOX_LINE_COLOR, CARD_COLOR, CELL_SIZE, SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PickerViewBindings {
    /** The cell a number is being chosen for, or -1 while the picker is closed. */
    cell: () => number;
    /** The digit filled into the cell now, lit, or 0. */
    digit: () => number;
    /** The player chose `digit` for the cell, or 0 to empty it. */
    onChosen: (digit: number) => void;
    /** The player tapped away from the picker, choosing nothing. */
    onClosed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The choice of a number for a cell: the digits 1 to 9, 3 by 3, and a key to
 * empty the cell. It opens just below the cell, or just above it if there
 * is no room below, so the cell stays in sight. A tap anywhere else closes
 * it. It covers the whole screen, as it is laid out in the screen's pixels.
 */
export function PickerView(bindings: PickerViewBindings): Container {
    const isOpen = (): boolean => bindings.cell() >= 0;
    const keys: Container[] = [];
    for (let digit = 1; digit <= 9; digit++) {
        keys.push(
            <ButtonView
                x={PADDING + ((digit - 1) % 3) * (KEY_SIZE + KEY_GAP)}
                y={PADDING + Math.floor((digit - 1) / 3) * (KEY_SIZE + KEY_GAP)}
                width={KEY_SIZE}
                height={KEY_SIZE}
                label={String(digit)}
                labelSize={28}
                isLit={() => bindings.digit() === digit}
                onPressed={() => bindings.onChosen(digit)}
            />,
        );
    }
    return (
        <container visible={isOpen}>
            <graphics
                ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill({ color: BOX_LINE_COLOR, alpha: 0.12 })}
                onPointerTap={bindings.onClosed}
            />
            <container x={() => findPanelX(bindings.cell())} y={() => findPanelY(bindings.cell())}>
                <graphics ref={(g) => g.roundRect(3, 5, PANEL_WIDTH, PANEL_HEIGHT, 16).fill({ color: BOX_LINE_COLOR, alpha: 0.18 })} />
                <graphics
                    ref={(g) => g.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 16).fill(CARD_COLOR).stroke({ color: BOX_LINE_COLOR, width: 1.5 })}
                    eventMode="static"
                />
                {keys}
                <ButtonView
                    x={PADDING}
                    y={PADDING + KEY_SIZE * 3 + KEY_GAP * 2 + KEY_GAP}
                    width={PANEL_WIDTH - PADDING * 2}
                    height={CLEAR_HEIGHT}
                    label="Clear"
                    onPressed={() => bindings.onChosen(0)}
                />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KEY_SIZE = 56;
const KEY_GAP = 6;
const PADDING = 12;
const CLEAR_HEIGHT = 44;
const PANEL_WIDTH = PADDING * 2 + KEY_SIZE * 3 + KEY_GAP * 2;
const PANEL_HEIGHT = PADDING * 2 + KEY_SIZE * 3 + KEY_GAP * 3 + CLEAR_HEIGHT;
/** The gap between the cell and the panel, and the panel and the screen's edges. */
const GAP = 8;

/** Where the panel's left edge goes: centred on the cell, but kept on screen. */
function findPanelX(cell: number): number {
    const middle = findCellMiddleX(cell);
    return Math.min(SCREEN_WIDTH - GAP - PANEL_WIDTH, Math.max(GAP, middle - PANEL_WIDTH / 2));
}

/** Where the panel's top goes: below the cell if it fits there, and above it if not. */
function findPanelY(cell: number): number {
    const top = findCellTop(cell);
    const below = top + CELL_SIZE + GAP;
    return below + PANEL_HEIGHT <= SCREEN_HEIGHT - GAP ? below : top - GAP - PANEL_HEIGHT;
}
