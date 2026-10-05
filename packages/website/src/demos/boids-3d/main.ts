import { runEntryPage } from '../../runner';
import { boids3dEntry } from './boids-3d-entry';

// The flock in 3D, as a page of its own, until the arcade lists every entry
// on one page. The entry builds itself in the page's element, and the runner
// drives its frames.

const element = document.getElementById('entry');
if (element === null) throw new Error('The page has no #entry element');
void runEntryPage({ entry: boids3dEntry, element });
