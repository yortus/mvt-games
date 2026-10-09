import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';
import { WinBannerView } from './win-banner-view';

const WIN = 1250;
const CAPTION = '5 cherries pay 1,250';

describe('WinBannerView', () => {
    // The banner starts at the amount it sees when it is built. So a win shown
    // from the start is already fully counted.
    visualTest('a win, counted', () => WinBannerView({ isShown: () => true, amount: () => WIN, caption: () => CAPTION }), { artStyle: 'smooth' });

    // The count is presentation state. Here the win arrives after the banner is
    // built, and then time passes.
    visualTest('counting up, 300 ms in', async () => {
        let amount = 0;
        const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => CAPTION });
        amount = WIN;
        await advanceTime({ views: [view], totalMs: 300 });
        return view;
    }, { artStyle: 'smooth' });
});
