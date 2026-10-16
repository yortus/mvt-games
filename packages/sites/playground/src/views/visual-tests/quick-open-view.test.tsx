import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { QuickOpenView } from '../quick-open-view';

// The dialog covers the page and centres in it, so the page and the image are given one size
htmlTest('open, with a query typed', { viewport: { width: 640, height: 360 }, width: 640, height: 360 }, () => QuickOpenView({
    isOpen: () => true,
    query: () => 'ball',
    matches: () => ['models/ball-model.ts', 'views/ball-view.ts'],
}));
