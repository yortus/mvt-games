import { runEntryPage } from '../../runner';
import { fruitMachineEntry } from './fruit-machine-entry';

// The fruit machine, as a page of its own, until the arcade lists every entry
// on one page. The entry builds its four quadrants in the page's element, and
// the runner drives their frames.

const element = document.getElementById('entry');
if (element === null) throw new Error('The page has no #entry element');
void runEntryPage({ entry: fruitMachineEntry, element });
