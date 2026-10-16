import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { CodeEditorView } from '../code-editor-view';
import { inBox } from './in-box';

const TEXT = `import { definePixiProject } from 'playground';

export const project = definePixiProject({
    width: 400,
    height: 300,
    start: ({ stage }) => {
        // Build the models and views here
    },
});
`;

htmlTest('a file open', () => inBox(CodeEditorView({
    activePath: () => 'main.ts',
    textOf: () => TEXT,
    projectsOpened: () => 1,
    shownPlace: () => undefined,
    placesShown: () => 0,
}), 600, 260));
