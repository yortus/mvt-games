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

const BASE = {
    activePath: () => 'main.ts',
    textOf: () => TEXT,
    isReadOnly: () => false,
    projectsOpened: () => 1,
    externalEdits: () => 0,
    shownPlace: () => undefined,
    placesShown: () => 0,
    typeChecks: () => 0,
    typeProblemsFor: () => [],
};

htmlTest('a file open', () => inBox(CodeEditorView(BASE), 600, 260));

// `width: 400` is underlined, as a type error would be
const WIDTH_AT = TEXT.indexOf('width: 400');
const PROBLEM = {
    path: 'main.ts', line: 4, column: 5, start: WIDTH_AT, length: 'width: 400'.length,
    message: 'Type \'string\' is not assignable to type \'number\'.', severity: 'error' as const, fixes: [],
};

htmlTest('a type problem underlined', () => inBox(CodeEditorView({ ...BASE, typeProblemsFor: () => [PROBLEM] }), 600, 260));
