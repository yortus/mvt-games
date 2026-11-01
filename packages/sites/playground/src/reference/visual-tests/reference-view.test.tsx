import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { createReferenceModel, type ReferenceModel, USED_ID } from '../reference-model';
import { ReferenceView } from '../reference-view';
import { inBox } from './in-box';
import { CREATE_REACTION, SAMPLE_SHEETS } from './sample-sheets';

const WIDTH = 360;
const HEIGHT = 520;

/** The cheat sheet, open, in a pane of the playground's size, with its model arranged first. */
function referenceView(arrange?: (model: ReferenceModel) => void): HTMLElement {
    const model = createReferenceModel({ renderer: 'pixi', sheets: SAMPLE_SHEETS });
    arrange?.(model);
    const view = ReferenceView({
        model,
        isOpen: () => true,
        chapterUrlOf: (path) => `/docs/${path}.html`,
        onDefinitionPressed: () => undefined,
    });
    return inBox(view, WIDTH, HEIGHT);
}

htmlTest('loading', () => {
    const model = createReferenceModel({ renderer: 'pixi' });
    return inBox(ReferenceView({ model, isOpen: () => true, chapterUrlOf: (path) => path }), WIDTH, HEIGHT);
});

htmlTest('on a sheet', () => referenceView((model) => {
    model.chosenId = 'watching-for-changes';
}));

htmlTest('an entry open', () => referenceView((model) => {
    model.chosenId = 'watching-for-changes';
    model.toggleEntry(CREATE_REACTION);
}));

htmlTest('a search', () => referenceView((model) => {
    model.query = 'circle';
}));

htmlTest('a search that matches nothing', () => referenceView((model) => {
    model.query = 'teleport';
}));

htmlTest('what the project uses', () => referenceView((model) => {
    model.usedNames = [{ name: 'createReaction', from: '@mvtjs/utils' }, { name: 'Graphics', from: 'pixi.js' }];
    model.chosenId = USED_ID;
}));
