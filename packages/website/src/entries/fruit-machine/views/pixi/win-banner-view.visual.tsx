import { describe } from 'vitest';
import { advanceTime, visualTest } from '#testing';
import { WinBannerView } from './win-banner-view';

const WIN = 1250;
const CAPTION = '5 cherries pay 1,250';

describe('WinBannerView', () => {
    // The banner starts at the amount it sees when built, so a win shown from the start is already counted
    visualTest('a win, counted', () => WinBannerView({ isShown: () => true, amount: () => WIN, caption: () => CAPTION }));

    // The count is presentation state: the win arrives after the banner is built, and time passes
    visualTest('counting up, 300 ms in', async () => {
        let amount = 0;
        const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => CAPTION });
        amount = WIN;
        await advanceTime({ views: [view], totalMs: 300 });
        return view;
    });
});
