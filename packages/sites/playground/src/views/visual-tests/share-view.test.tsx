import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { ShareView } from '../share-view';
import { inBox } from './in-box';

// The dialog covers the page and centres in it, so the page and the image are given one size
const SIZE = { viewport: { width: 640, height: 360 }, width: 640, height: 360 };
const LINK = 'https://yortus.github.io/mvt-games/playground/#p1=H4sIAAAAAAAAA6tWKkktLlGyUlAqzy_KSVGqBQBiS3XzEQAAAA';

htmlTest('the link copied', SIZE, () => inBox(ShareView({ status: () => 'copied', link: () => LINK }), 640, 360));

htmlTest('the link not copied', SIZE, () => inBox(ShareView({ status: () => 'failed', link: () => LINK }), 640, 360));

htmlTest('too large for a link', SIZE, () => inBox(ShareView({ status: () => 'too-large', link: () => undefined }), 640, 360));
