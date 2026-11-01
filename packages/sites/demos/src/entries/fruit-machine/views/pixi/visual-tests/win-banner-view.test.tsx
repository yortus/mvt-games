import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { WinBannerView } from '../win-banner-view';

const WIN = 1250;
const CAPTION = '5 cherries pay 1,250';

// The banner starts at the amount it sees when it is built. So a win shown
// from the start is already fully counted.
canvasTest('a win, counted', { pixelArt: false }, () => WinBannerView({ isShown: () => true, amount: () => WIN, caption: () => CAPTION }));

// The count is presentation state. Here the win arrives after the banner is
// built, and then time passes.
canvasTest('counting up, 300 ms in', { pixelArt: false }, async () => {
    let amount = 0;
    const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => CAPTION });
    amount = WIN;
    await advanceTime(300, view);
    return view;
});
