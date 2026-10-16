import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { EXAMPLES } from '../../examples';
import { createWorkspaceModel, THEME_KINDS } from '../../models';
import { PlaygroundView } from '../playground-view';
import { THEMES } from '../themes';
import { inBox } from './in-box';

const WIDTH = 900;
const HEIGHT = 540;

/** The whole playground, with the first example open and nothing run. */
function playground(arrange?: (model: ReturnType<typeof createWorkspaceModel>) => void): HTMLElement {
    const model = createWorkspaceModel({ project: EXAMPLES[0] });
    arrange?.(model);
    return inBox(PlaygroundView({ model, examples: EXAMPLES }), WIDTH, HEIGHT);
}

htmlTest('an example open, not run yet', { viewport: { width: WIDTH, height: HEIGHT } }, () => playground());

htmlTest('the file list folded, and the panes resized', { viewport: { width: WIDTH, height: HEIGHT } }, () => playground((model) => {
    model.layout.toggleFiles();
    model.layout.resizeRun(-120);
    model.layout.resizeConsole(60);
}));

htmlTest('the Problems tab, with a problem', { viewport: { width: WIDTH, height: HEIGHT } }, () => playground((model) => {
    model.run();
    model.reportProblems([{ path: 'main.ts', line: 3, message: 'Unexpected token' }]);
    model.layout.showRunPaneTab('problems');
}));

htmlTest('on a narrow screen, showing the run', { viewport: { width: 420, height: HEIGHT } }, () => {
    const model = createWorkspaceModel({ project: EXAMPLES[0] });
    model.layout.showPanel('run');
    return inBox(PlaygroundView({ model, examples: EXAMPLES }), 420, HEIGHT);
});

// Each theme, with problems of both kinds and a file's count showing, so a colour the theme misses shows as a patch of another
for (const theme of THEME_KINDS) {
    htmlTest(`in ${THEMES[theme].name}`, { viewport: { width: WIDTH, height: HEIGHT } }, () => {
        const model = createWorkspaceModel({ project: EXAMPLES[0], theme });
        model.run();
        model.reportProblems([{ path: 'main.ts', line: 3, message: 'Unexpected token' }]);
        model.reportTypeProblems({
            checkNumber: model.checksRequested,
            problems: [{ path: 'main.ts', line: 5, column: 1, start: 0, length: 6, message: 'A warning', severity: 'warning', fixes: [] }],
        });
        model.layout.showRunPaneTab('problems');
        return inBox(PlaygroundView({ model, examples: EXAMPLES }), WIDTH, HEIGHT, theme);
    });
}
