import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { LIBRARIES, LIBRARY_SUMMARIES } from '../../../libraries';
import { HelpView } from '../help-view';
import { inBox } from './in-box';

// The dialog covers the page and centres in it, so the page and the image are given one size
const SIZE = { viewport: { width: 800, height: 600 }, width: 800, height: 600 };

// The libraries a project imports by hand, with what each is for, as the page passes them
const LIBRARIES_WITH_SUMMARIES = LIBRARIES
    .filter((library) => !library.endsWith('/jsx-runtime'))
    .map((library) => ({ name: library, summary: LIBRARY_SUMMARIES[library] }));

htmlTest('open, at the top', SIZE, () => inBox(HelpView({ isOpen: () => true, libraries: LIBRARIES_WITH_SUMMARIES }), 800, 600));
