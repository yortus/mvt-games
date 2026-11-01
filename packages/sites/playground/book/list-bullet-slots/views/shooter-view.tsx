/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { ShooterModel } from '../models';
import { BulletView } from './bullet-view';
import { ShipView } from './ship-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShooterViewBindings {
    readonly model: ShooterModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship and its bullets, and below them, the bullet list's slots. Each
 * slot of a `<List>` is built once, the first time it holds a bullet, and
 * then shows whichever bullet is in it. The second `<List>`, over the same
 * slots, draws a square for each slot that holds a bullet now.
 *
 * Press and hold anywhere to fire faster, and watch the list grow.
 */
export function ShooterView({ model, width, height }: ShooterViewBindings): Container {
    const slotCountText = createComputed({
        watch: () => model.bullets.slots.length,
        compute: (count) => `Slots in the list: ${count}`,
    });
    const bulletCountText = createComputed({
        watch: () => model.bullets.liveCount,
        compute: (count) => `Bullets: ${count}`,
    });

    return (
        <container
            hitArea={new Rectangle(0, 0, width, height + PANEL_HEIGHT)}
            onPointerDown={() => { model.isFiringRapidly = true; }}
            onPointerUp={() => { model.isFiringRapidly = false; }}
            onPointerUpOutside={() => { model.isFiringRapidly = false; }}
        >
            <List items={model.bullets.slots}>
                {(slot) => (
                    <BulletView x={() => slot().value.x} y={() => slot().value.y} />
                )}
            </List>
            <ShipView x={model.shipX} y={() => model.shipY} />

            <container y={height}>
                <graphics ref={(g) => drawPanel(g, width)} />
                <text text={slotCountText} x={16} y={8} style={LABEL_STYLE} />
                <text text={bulletCountText} x={250} y={8} style={LABEL_STYLE} />
                <text text="Hold to fire faster" anchor={1} x={width - 16} y={24} style={HINT_STYLE} />
                <container x={16} y={36}>
                    <graphics ref={drawEmptyMarkers} />
                    <List items={model.bullets.slots}>
                        {(_slot, index) => <graphics x={index * MARKER_SPACING} ref={drawMarker} />}
                    </List>
                </container>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How tall the panel below the play area is, in pixels. */
const PANEL_HEIGHT = 70;
/** How far apart the slots' squares are, and how many outlines to draw for them. */
const MARKER_SPACING = 12;
const MARKER_OUTLINES = 50;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0xe8ecff };
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0x667799 };

function drawPanel(g: Graphics, width: number): void {
    g.rect(0, 0, width, PANEL_HEIGHT).fill(0x141b33);
    g.moveTo(0, 0).lineTo(width, 0).stroke({ color: 0x2a3866, width: 2 });
}

function drawEmptyMarkers(g: Graphics): void {
    for (let i = 0; i < MARKER_OUTLINES; i++) {
        g.rect(i * MARKER_SPACING, 0, 10, 16).stroke({ color: 0x2a3866, width: 1 });
    }
}

function drawMarker(g: Graphics): void {
    g.rect(0, 0, 10, 16).fill(0xffe08a);
}
