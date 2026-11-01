import { type Container, Text } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { definePixiProject } from 'playground';
import { createWinRoundModel } from './models';
import { PoseFrameView, WinBannerView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * How far into its count-up each test poses the banner, in ms. Try other
 * moments, such as [0, 100, 200, 300]: each is a still image, whatever the
 * running banner below is doing.
 */
const POSE_MS = [0, 300, 600, 1200];

/** The amount won, which the banner counts up to. */
const WIN = 2500;
/** The banner's caption. */
const CAPTION = 'BONUS POINTS!';

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// The project: four visual tests' poses of a banner across the top, and
// the same banner in a running game below them.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x1a1226,
    start: async ({ stage }) => {
        const frameWidth = 140;
        const gap = (WIDTH - POSE_MS.length * frameWidth) / (POSE_MS.length + 1);
        for (let i = 0; i < POSE_MS.length; i++) {
            const frame = PoseFrameView({
                title: `${POSE_MS[i]} ms in`,
                pose: await poseBanner(POSE_MS[i]),
                width: frameWidth,
                height: 70,
                scale: 0.5,
            });
            frame.position.set(gap + i * (frameWidth + gap), 16);
            stage.addChild(frame);
        }

        const model = createWinRoundModel({ win: WIN, roundMs: 3000, winAtMs: 600 });
        const live = WinBannerView({ isShown: () => model.amount > 0, amount: () => model.amount, caption: () => CAPTION });
        live.position.set(WIDTH / 2, 262);
        const liveTitle = new Text({
            text: 'The same banner, in a running game',
            style: { fontFamily: 'monospace', fontSize: 12, fill: 0xd8d0e8 },
        });
        liveTitle.anchor.set(0.5, 0);
        liveTitle.position.set(WIDTH / 2, 160);
        stage.addChild(liveTitle, live);

        return model;
    },
});

// A test's pose: the banner built with stand-in bindings, then the amount
// raised, then time moved on by a set amount. A visual test would return
// the view, and the test tool would refresh it once and take its image.
async function poseBanner(ms: number): Promise<Container> {
    let amount = 0;
    const view = WinBannerView({
        isShown: () => true,
        amount: () => amount,
        caption: () => CAPTION,
    });
    // The banner counts up from the amount it was built with.
    amount = WIN;
    await advanceTime(ms, view);
    return view;
}
