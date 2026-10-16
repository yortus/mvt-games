import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { EXAMPLES } from '../../examples';
import { createWorkspaceModel } from '../../models';
import { PlaygroundView } from '../playground-view';
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
