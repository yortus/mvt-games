import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { FileListView } from '../file-list-view';
import { inBox } from './in-box';

const PATHS = ['main.ts', 'models/ball-model.ts', 'models/index.ts', 'views/ball-view.ts', 'views/index.ts'];

htmlTest('a project\'s files, one open', () => inBox(FileListView({
    paths: () => PATHS,
    activePath: () => 'models/ball-model.ts',
    fixedPath: 'main.ts',
    isFolded: () => false,
}), 230, 220));

htmlTest('folded away', () => inBox(FileListView({
    paths: () => PATHS,
    activePath: () => 'main.ts',
    fixedPath: 'main.ts',
    isFolded: () => true,
}), 34, 220));
