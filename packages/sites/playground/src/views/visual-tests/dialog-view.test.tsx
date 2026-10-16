import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { DialogView } from '../dialog-view';
import { createDialogs } from '../dialogs';
import { inBox } from './in-box';

// The dialog covers the page and centres in it, so the page and the image are given one size
const SIZE = { viewport: { width: 640, height: 360 }, width: 640, height: 360 };

htmlTest('asking to confirm a loss', SIZE, () => {
    const dialogs = createDialogs();
    void dialogs.confirm({ title: 'Remove models/ball-model.ts?', message: 'It cannot be brought back.', confirmLabel: 'Remove', isDangerous: true });
    return inBox(DialogView({ dialogs }), 640, 360);
});

htmlTest('asking for a path', SIZE, () => {
    const dialogs = createDialogs();
    void dialogs.prompt({ title: 'New file', message: 'Its path, such as models/ship-model.ts.', value: 'models/', confirmLabel: 'Add' });
    return inBox(DialogView({ dialogs }), 640, 360);
});
