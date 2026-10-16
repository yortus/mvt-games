import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { FileListView, type FileListViewBindings } from '../file-list-view';
import { inBox } from './in-box';

const PATHS = ['main.ts', 'models/ball-model.ts', 'models/index.ts', 'views/ball-view.ts', 'views/index.ts'];

const BASE: FileListViewBindings = {
    paths: () => PATHS,
    activePath: () => 'models/ball-model.ts',
    fixedPath: 'main.ts',
    isFolded: () => false,
    foldedFolders: () => new Set(),
    problemCountOf: () => 0,
    isKeptBarrel: (path) => path.endsWith('/index.ts'),
};

htmlTest('a project\'s files, one open', () => inBox(FileListView(BASE), 230, 260));

htmlTest('a file with errors', () => inBox(FileListView({ ...BASE, problemCountOf: (path) => (path === 'views/ball-view.ts' ? 2 : 0) }), 230, 260));

const DEEP_PATHS = ['main.ts', 'game/index.ts', 'game/pieces/index.ts', 'game/pieces/king.ts', 'game/rules.ts', 'notes.ts', 'views/board-view.ts', 'views/index.ts'];
const FOLDED = new Set(['views']);

htmlTest('folders within folders, one folded with errors in it', () => inBox(FileListView({
    ...BASE,
    paths: () => DEEP_PATHS,
    activePath: () => 'game/pieces/king.ts',
    foldedFolders: () => FOLDED,
    problemCountOf: (path) => (path === 'views/' ? 3 : 0),
}), 230, 280));

htmlTest('barrels left to the visitor', () => inBox(FileListView({ ...BASE, isKeptBarrel: () => false }), 230, 260));

htmlTest('folded away', () => inBox(FileListView({ ...BASE, isFolded: () => true }), 34, 260));
