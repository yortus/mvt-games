import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { EXAMPLES, STARTERS } from '../../examples';
import type { ProjectSummary } from '../../models';
import { ProjectsView, type ProjectsViewBindings } from '../projects-view';
import { inBox } from './in-box';

const PROJECTS: ProjectSummary[] = [
    { id: 'a', name: 'Bouncing Ball', description: 'A ball that falls and bounces, and can be thrown.', savedAt: Date.UTC(2026, 9, 16, 9, 40), fileCount: 5 },
    { id: 'b', name: 'My first project', description: '', savedAt: Date.UTC(2026, 9, 15, 20, 5), fileCount: 3 },
    { id: 'c', name: 'New three.js project', description: '', savedAt: Date.UTC(2026, 9, 1, 12, 0), fileCount: 1 },
];

const BASE: ProjectsViewBindings = {
    isOpen: () => true,
    projects: () => PROJECTS,
    openId: () => 'a',
    isKept: () => true,
    starters: STARTERS,
    examples: EXAMPLES,
};

// The dialog covers the page and centres in it, so the page and the image are given one size
const SIZE = { viewport: { width: 640, height: 420 }, width: 640, height: 420 };

htmlTest('kept projects, one open', SIZE, () => inBox(ProjectsView(BASE), 640, 420));

htmlTest('none kept yet, in a browser that keeps nothing', SIZE, () => inBox(ProjectsView({ ...BASE, projects: () => [], isKept: () => false }), 640, 420));
