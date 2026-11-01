import { Container, Graphics, Text } from 'pixi.js';
import type { BulletModel } from '../models';
import { BulletView } from './bullet-view';
import { DriftingBulletView } from './drifting-bullet-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RangeViewBindings {
    readonly model: BulletModel;
    /** The width of the play area, in world units, which are this view's pixels. */
    readonly width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Two lanes of a shooting range, each with a gun, and the model's one bullet
 * shown in both: on the left by a view that reads the model every frame,
 * and on the right by one that moves itself.
 */
export function RangeView({ model, width }: RangeViewBindings): Container {
    const view = new Container();
    const leftX = width / 2 - LANE_GAP;
    const rightX = width / 2 + LANE_GAP;

    // Drawn once: the lanes, the guns and the labels never change
    const lanes = new Graphics();
    for (const x of [leftX, rightX]) {
        lanes.rect(x - LANE_WIDTH / 2, model.topY - 10, LANE_WIDTH, model.gunY - model.topY + 20).fill(0x1a2133);
        lanes.poly([x, model.gunY - 6, x - 10, model.gunY + 10, x + 10, model.gunY + 10]).fill(0x8899bb);
    }
    view.addChild(
        lanes,
        makeLabel('reads the model', leftX, model.gunY + 26, 0xffffff),
        makeLabel('moves itself', rightX, model.gunY + 26, 0xff6655),
    );

    // The same bullet, twice. Only the wiring knows it's one bullet, in two lanes.
    view.addChild(
        BulletView({ x: () => leftX, y: () => model.y }),
        DriftingBulletView({ x: () => rightX, y: () => model.y, gunY: model.gunY, topY: model.topY }),
    );

    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far each lane's middle is from the middle of the play area. */
const LANE_GAP = 80;
const LANE_WIDTH = 90;

function makeLabel(text: string, x: number, y: number, fill: number): Text {
    const label = new Text({ text, style: { fontFamily: 'monospace', fontSize: 14, fill } });
    label.anchor.set(0.5, 0);
    label.position.set(x, y);
    return label;
}
