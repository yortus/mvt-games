import type { ReferenceEntry, ReferenceSheet } from '../../../cheat-sheets';

// Two sheets, as the build makes them, for the cheat sheet's poses: a few
// entries each, with signatures, summaries, snippets and links.

export const CREATE_REACTION: ReferenceEntry = {
    name: 'createReaction',
    from: '@mvtjs/utils',
    importLine: "import { createReaction } from '@mvtjs/utils';",
    signature: 'createReaction(options: {\n    watch: () => T;\n    when?: T | ((current: T, previous: T) => boolean);\n    react: (current: T, previous: T) => void;\n}): () => void',
    summary: 'Creates a reaction: a function to call on every step, which runs `react` for each change that `when` accepts.',
    useFor: 'Do something once, at the moment a value changes, such as playing a sound as the score goes up. Call the reaction every tick.',
    snippet: 'const playChimeWhenScoreRises = createReaction({\n    watch: () => model.score,\n    when: increased,\n    react: () => sound.play(CHIME),\n});\nsetRefresh(view, playChimeWhenScoreRises);',
    chapter: { path: 'chapters/09-noticing-changes', title: 'Chapter 9, Noticing Changes' },
};

const CREATE_COMPUTED: ReferenceEntry = {
    name: 'createComputed',
    from: '@mvtjs/utils',
    importLine: "import { createComputed } from '@mvtjs/utils';",
    signature: 'createComputed(options: {\n    watch: () => T;\n    compute: (current: T) => R;\n}): Computed<R>',
    summary: 'Creates a computed value, which computes on its first read, and again only when what it watches has changed.',
    useFor: "Make a value, such as a label's text, only when what it's made from changes. Read it by calling it.",
    chapter: { path: 'chapters/09-noticing-changes', title: 'Chapter 9, Noticing Changes' },
};

const INCREASED: ReferenceEntry = {
    name: 'increased',
    from: '@mvtjs/utils',
    importLine: "import { increased } from '@mvtjs/utils';",
    signature: 'increased<T>(current: T, previous: T): boolean',
    summary: "A condition for a reaction's `when`: the value went up.",
    useFor: "Pass it as a reaction's `when`, to react only as a number goes up, such as a count of shots fired.",
};

const SET_REFRESH: ReferenceEntry = {
    name: 'setRefresh',
    from: '@mvtjs/pixi',
    importLine: "import { setRefresh } from '@mvtjs/pixi';",
    signature: 'setRefresh(view: View, refresh: RefreshMethod | undefined): void',
    summary: "Sets `view`'s refresh method, which writes model state to its presentation output, or clears it with `undefined`.",
    useFor: "Give a view a refresh method, which writes the model's state to the view's display objects every tick.",
    chapter: { path: 'chapters/07-views', title: 'Chapter 7, Views' },
};

const GRAPHICS_CIRCLE: ReferenceEntry = {
    name: 'Graphics.circle',
    from: 'pixi.js',
    importLine: "import { Graphics } from 'pixi.js';",
    signature: 'Graphics.circle(x: number, y: number, radius: number): Graphics',
    summary: 'Draws a circle shape at the specified location with the given radius.',
    useFor: 'Add a circle to the path, from its centre.',
};

export const WATCHING_SHEET: ReferenceSheet = {
    id: 'watching-for-changes',
    title: 'Watching for changes',
    summary: 'How a view does something only when a value changes, rather than every tick: play a sound, rebuild some text, or redraw a shape.',
    moreAt: [],
    groups: [
        { title: 'Reactions and computed values', entries: [CREATE_REACTION, CREATE_COMPUTED] },
        { title: 'Conditions for when', entries: [INCREASED] },
    ],
};

export const PIXI_SHEET: ReferenceSheet = {
    id: 'pixi-essentials',
    title: 'Pixi essentials',
    summary: "The parts of Pixi that most views need: containers, shapes, text and sprites. Pixi's own docs cover the rest.",
    renderers: ['pixi'],
    moreAt: [{ label: "Pixi's guides", url: 'https://pixijs.com/8.x/guides' }],
    groups: [{ title: 'Shapes', entries: [GRAPHICS_CIRCLE] }],
};

export const TICK_SHEET: ReferenceSheet = {
    id: 'the-tick',
    title: 'The tick',
    summary: "How a view writes the model's state every tick, and moves its own presentation state on.",
    moreAt: [],
    groups: [{ title: 'A view tick by tick', entries: [SET_REFRESH] }],
};

export const SAMPLE_SHEETS: readonly ReferenceSheet[] = [TICK_SHEET, WATCHING_SHEET, PIXI_SHEET];
