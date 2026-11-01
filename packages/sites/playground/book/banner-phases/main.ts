import { definePixiProject } from 'playground';
import { type BannerPhase, createBannerModel } from './models';
import { BannerView, ButtonView, PhaseReadoutView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

/** The banner's phases, for the readout, in the order they run from show() to closed again. */
const PHASES: readonly BannerPhase[] = ['opening', 'open', 'closing', 'closed'];

// A banner that slides in, stays, and slides out. Below it, a readout shows
// just what the model gives its views: one phase, and one progress through
// it. The banner is shown as the project starts, and the button shows it
// again once it's closed.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const banner = createBannerModel();

        const bannerView = BannerView({ phase: () => banner.phase, progress: () => banner.progress, text: 'Get ready!' });
        bannerView.y = 80;

        const readout = PhaseReadoutView({ phases: PHASES, phase: () => banner.phase, progress: () => banner.progress, width: READOUT_WIDTH });
        readout.position.set((WIDTH - READOUT_WIDTH) / 2, 160);

        const button = ButtonView({ label: 'show()', width: BUTTON_WIDTH, onPressed: () => banner.show() });
        button.position.set((WIDTH - BUTTON_WIDTH) / 2, 300);

        stage.addChild(bannerView, readout, button);
        banner.show();
        return banner;
    },
});

const READOUT_WIDTH = 520;
const BUTTON_WIDTH = 140;
