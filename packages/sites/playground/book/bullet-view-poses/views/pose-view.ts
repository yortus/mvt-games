import { Container, Graphics, Text } from 'pixi.js';
import { type ReadoutViewBindings, ReadoutView } from './readout-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PoseViewBindings {
    /** The test's name, which may take two lines. */
    readonly title: string;
    /** The view the test built, which this view frames. */
    readonly pose: Container;
    /** The size of the pose's screen, in pixels. The pose is clipped to it. */
    readonly width: number;
    readonly height: number;
    /** The values the test's assertions read, one to a line. */
    readonly readouts: readonly ReadoutViewBindings[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A test's view, in a frame the size of its screen, with the test's name
 * above it. Below it are the values the test's assertions read, as they
 * stand after each refresh.
 */
export function PoseView({ title, pose, width, height, readouts }: PoseViewBindings): Container {
    const view = new Container();

    const titleText = new Text({ text: title, style: { ...TEXT_STYLE, fill: 0xffffff, lineHeight: 16 } });

    const screen = new Container();
    screen.y = SCREEN_Y;
    const background = new Graphics().rect(0, 0, width, height).fill(0x0c1020).stroke({ color: 0x3a4260, width: 2, alignment: 1 });
    const clip = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    screen.addChild(background, pose, clip);
    screen.mask = clip;

    view.addChild(titleText, screen);

    // Each readout is added after the pose, so it's refreshed after it too,
    // and reads what this tick's refresh wrote
    for (let i = 0; i < readouts.length; i++) {
        const readout = ReadoutView(readouts[i]);
        readout.y = SCREEN_Y + height + 12 + i * 20;
        view.addChild(readout);
    }

    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the screen starts, below the title. */
const SCREEN_Y = 40;

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: 12, fill: 0xb8c4dc };
