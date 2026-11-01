import { htmlTest } from 'v-snap';
import '../../arcade.css';
import { EntryNoticeView } from '../entry-notice-view';
import { wearTheme } from './wear-theme.test-support';

/** The notice, open. It is fixed over the whole viewport, below where the runner's bar would be, so the image is the viewport. */
function open(): Element {
    return EntryNoticeView({
        isOpen: () => true,
        notice: () => ({
            title: 'Before you play',
            text: 'This demo flashes brightly as the level ends.\n\nTurn on reduced motion in your system settings to soften it.',
        }),
    });
}

htmlTest('open', { viewport: { width: 520, height: 420 }, width: 520, height: 420 }, open);

htmlTest('open on a phone', { viewport: { width: 360, height: 520 }, width: 360, height: 520 }, open);

htmlTest('open, in the Dark theme', { viewport: { width: 520, height: 420 }, width: 520, height: 420 }, () => {
    wearTheme('dark');
    return open();
});

htmlTest('open, in the Light theme', { viewport: { width: 520, height: 420 }, width: 520, height: 420 }, () => {
    wearTheme('light');
    return open();
});
