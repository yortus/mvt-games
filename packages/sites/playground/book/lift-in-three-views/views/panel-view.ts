import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { LiftDirection } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PanelViewBindings {
    /** Where the lift is, in floors. */
    readonly floor: () => number;
    readonly direction: () => LiftDirection;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A modern panel beside the lift doors: the nearest floor, in lit digits,
 * with an arrow for the way the lift is going. It fills a box 180 wide and
 * 220 tall.
 */
export function PanelView(bindings: PanelViewBindings): Container {
    const view = new Container();

    const panel = new Graphics();
    panel.roundRect(40, 30, 100, 160, 10).fill(0x050608).stroke({ color: 0x3a4660, width: 2 });
    const upArrow = new Graphics().poly([90, 48, 74, 68, 106, 68]).fill(0x44ffaa);
    const downArrow = new Graphics().poly([90, 172, 74, 152, 106, 152]).fill(0x44ffaa);
    const digits = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 56, fontWeight: 'bold', fill: 0xff8844 } });
    digits.anchor.set(0.5, 0.5);
    digits.position.set(90, 110);
    view.addChild(panel, upArrow, downArrow, digits);

    // The text is made again only when the nearest floor changes
    const floorName = createComputed({ watch: () => Math.round(bindings.floor()), compute: nameFloor });

    function refresh(): void {
        digits.text = floorName();
        const direction = bindings.direction();
        upArrow.visible = direction === 'up';
        downArrow.visible = direction === 'down';
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function nameFloor(floor: number): string {
    return floor === 0 ? 'G' : String(floor);
}
