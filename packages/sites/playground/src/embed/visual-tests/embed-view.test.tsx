import { htmlTest } from 'v-snap';
import '../../playground.css';
import '../../embed.css';
import type { ReferenceSheet } from '../../../cheat-sheets';
import { PALETTES, writePalette } from '../../palettes';
import { MAIN_PATH } from '../../runtime';
import { createEmbedModel, type EmbedModel } from '../embed-model';
import { EmbedView } from '../embed-view';

const WIDTH = 640;
const HEIGHT = 420;
/** The editor's height, which the docs add to the embed's as it opens. */
const EDITOR_HEIGHT = 200;

htmlTest('starting', { viewport: { width: WIDTH, height: HEIGHT } }, () => embed());

htmlTest('with its name and Open in the playground, for a page that asks for them', { viewport: { width: WIDTH, height: HEIGHT } }, () => embed(undefined, WIDTH, true));

htmlTest('editing, with the list of files open', { viewport: { width: WIDTH, height: HEIGHT + EDITOR_HEIGHT } }, () => embed((model) => {
    model.startEditing();
    model.toggleFileMenu();
}));

htmlTest('the cheat sheet open, on what the example uses', { viewport: { width: WIDTH, height: HEIGHT + EDITOR_HEIGHT } }, () => embed((model) => {
    model.startEditing();
    model.reference.sheets = SHEETS;
    model.toggleReference();
}));

htmlTest('the cheat sheet open on a narrow embed', { viewport: { width: 420, height: HEIGHT + EDITOR_HEIGHT } }, () => embed((model) => {
    model.startEditing();
    model.reference.sheets = SHEETS;
    model.toggleReference();
}, 420));

/** The embed, with an example that imports `watch`, and its model arranged first, in a box of the iframe's size. */
function embed(arrange?: (model: EmbedModel) => void, width = WIDTH, isNameShown = false): HTMLElement {
    const model = createEmbedModel({
        example: {
            id: 'score',
            name: 'A Score That Rolls Up',
            files: [
                { path: MAIN_PATH, text: "import { definePixiProject } from 'playground';" },
                { path: 'views/score-view.ts', text: "import { watch } from '@mvtjs/utils';" },
            ],
        },
        path: undefined,
        theme: 'github-dark',
    });
    arrange?.(model);
    const box = document.createElement('div');
    const height = model.isEditing ? HEIGHT + EDITOR_HEIGHT : HEIGHT;
    box.style.cssText = `width:${width}px;height:${height}px;display:flex;flex-direction:column;`;
    box.style.setProperty('--embed-editor-height', `${EDITOR_HEIGHT}px`);
    writePalette(box, PALETTES[model.theme]);
    const view = EmbedView({ model, editorPane: document.createElement('div'), isNameShown, isPlaygroundLinkShown: isNameShown, chapterUrlOf: (path) => `/docs/${path}.html` });
    if (view instanceof HTMLElement) view.style.flex = '1';
    box.append(view);
    return box;
}

const SHEETS: readonly ReferenceSheet[] = [
    {
        id: 'your-project',
        title: 'Your project',
        summary: 'What your `main.ts` exports, and what the playground passes to your `start` function.',
        moreAt: [],
        groups: [{
            title: 'Defining the project',
            entries: [{
                name: 'definePixiProject',
                from: 'playground',
                importLine: "import { definePixiProject } from 'playground';",
                signature: 'definePixiProject(options: PixiProjectOptions): PixiProject',
                summary: 'Returns a project drawn with Pixi.',
                useFor: 'Start a project that draws in 2D with Pixi. `start` adds your views to the `stage`, and returns your model.',
            }],
        }],
    },
    {
        id: 'watching-for-changes',
        title: 'Watching for changes',
        summary: 'How a view does something only when a value changes, rather than every tick.',
        moreAt: [],
        groups: [{
            title: 'Reactions and computed values',
            entries: [{
                name: 'watch',
                from: '@mvtjs/utils',
                importLine: "import { watch } from '@mvtjs/utils';",
                signature: 'watch(getters: (() => T) | Record<string, () => unknown>): Watcher',
                summary: 'Creates a watcher of one getter, or a record or array of getters.',
                useFor: 'Read several values at once, and see which have changed since you last polled. Poll it every tick.',
            }],
        }],
    },
];
