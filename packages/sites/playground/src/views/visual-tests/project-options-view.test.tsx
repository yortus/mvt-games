import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { ProjectOptionsView } from '../project-options-view';
import { inBox } from './in-box';

// The dialog covers the page and centres in it, so the page and the image are given one size
const SIZE = { viewport: { width: 640, height: 360 }, width: 640, height: 360 };

htmlTest('barrels auto-generated', SIZE, () => inBox(ProjectOptionsView({ isOpen: () => true, name: () => 'Bouncing Ball', description: () => 'A ball that falls and bounces, and can be thrown.', isBarrelKept: () => true }), 640, 360));

htmlTest('files managed by the visitor', SIZE, () => inBox(ProjectOptionsView({ isOpen: () => true, name: () => 'Bouncing Ball', description: () => '', isBarrelKept: () => false }), 640, 360));
