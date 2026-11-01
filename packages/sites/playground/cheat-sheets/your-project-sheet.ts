import type { CheatSheet } from './cheat-sheet';

/** What `main.ts` exports, and what the playground passes to `start`. */
export const YOUR_PROJECT_SHEET: CheatSheet = {
    id: 'your-project',
    title: 'Your project',
    summary: 'What your `main.ts` exports, and what the playground passes to your `start` function.',
    groups: [
        {
            title: 'Defining the project',
            entries: [
                {
                    name: 'definePixiProject',
                    from: 'playground',
                    useFor: 'Start a project that draws in 2D with Pixi. `start` adds your views to the `stage`, and returns your model.',
                    snippet: [
                        'export const project = definePixiProject({',
                        '    width: 400,',
                        '    height: 300,',
                        '    start: ({ stage }) => {',
                        '        const model = createBallModel();',
                        '        stage.addChild(BallView({ model }));',
                        '        return model;',
                        '    },',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/03-a-first-game',
                },
                {
                    name: 'defineHtmlProject',
                    from: 'playground',
                    useFor: 'Start a project built from HTML elements, such as a form or a board of buttons. `start` appends your views to `root`.',
                    snippet: [
                        'export const project = defineHtmlProject({',
                        '    start: ({ root }) => {',
                        '        const model = createCounterModel();',
                        '        root.append(CounterView({ model }));',
                        '        return model;',
                        '    },',
                        '});',
                    ].join('\n'),
                },
                {
                    name: 'defineThreeProject',
                    from: 'playground',
                    useFor: 'Start a 3D project drawn with three.js. `start` adds your views to the `scene`, which the `camera` looks at from 5 units back.',
                    snippet: [
                        'export const project = defineThreeProject({',
                        '    width: 400,',
                        '    height: 300,',
                        '    start: ({ scene }) => {',
                        '        const model = createSpinnerModel();',
                        '        scene.add(SpinnerView({ model }));',
                        '        return model;',
                        '    },',
                        '});',
                    ].join('\n'),
                },
            ],
        },
        {
            title: 'What start is passed, and what it returns',
            entries: [
                {
                    name: 'PixiStartOptions',
                    from: 'playground',
                    useFor: "See what a Pixi project's `start` is passed: the `stage` for your views, the `sound` chip, and the project's size.",
                },
                {
                    name: 'HtmlStartOptions',
                    from: 'playground',
                    useFor: "See what an HTML project's `start` is passed: the `root` element for your views, the `sound` chip, and the size.",
                },
                {
                    name: 'ThreeStartOptions',
                    from: 'playground',
                    useFor: "See what a three.js project's `start` is passed: the `scene` and `camera`, the `sound` chip, and the size.",
                },
                {
                    name: 'Ticked',
                    from: 'playground',
                    useFor: 'Return your model from `start`. Each tick, the playground calls its `update(deltaMs)`, then updates and refreshes your views.',
                    chapter: 'chapters/05-the-tick',
                },
            ],
        },
        {
            title: 'Checking your own code',
            entries: [
                {
                    name: 'assert',
                    from: '@mvtjs/utils',
                    useFor: "Stop with a clear message when something that must be true isn't, such as a precondition of a model's action.",
                    snippet: [
                        'assert(lives > 0, () => `No lives left to lose: ${lives}`);',
                    ].join('\n'),
                    chapter: 'chapters/31-design-by-contract',
                },
            ],
        },
    ],
};
