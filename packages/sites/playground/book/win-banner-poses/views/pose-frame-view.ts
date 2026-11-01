import { Container, Graphics, Text } from 'pixi.js';
import { setUpdate, SKIP_DESCENDANTS } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PoseFrameViewBindings {
    /** The test's name, shown above the frame. */
    readonly title: string;
    /** The posed view, centred on 0, 0. */
    readonly pose: Container;
    readonly width: number;
    readonly height: number;
    /** How much smaller than life the pose is shown. */
    readonly scale: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A posed view in a frame, as a visual test would take its image, with the
 * test's name above it. The frame's update step skips the views inside it,
 * so once a view is posed, no time passes for it. The game loop still
 * refreshes it, and a refresh draws the same thing every time.
 */
export function PoseFrameView({ title, pose, width, height, scale }: PoseFrameViewBindings): Container {
    const view = new Container();

    const titleText = new Text({ text: title, style: { fontFamily: 'monospace', fontSize: 12, fill: 0xd8d0e8 } });
    titleText.anchor.set(0.5, 0);
    titleText.position.set(width / 2, 0);

    const frame = new Graphics().rect(0, 22, width, height).fill(0x120c1c).stroke({ color: 0x4a3d66, width: 2, alignment: 1 });
    pose.scale.set(scale);
    pose.position.set(width / 2, 22 + height / 2);

    view.addChild(titleText, frame, pose);
    setUpdate(view, () => SKIP_DESCENDANTS);
    return view;
}
