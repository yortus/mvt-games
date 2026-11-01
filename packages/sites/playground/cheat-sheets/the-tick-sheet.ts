import type { CheatSheet } from './cheat-sheet';

/**
 * The view tick API. It's written as Pixi's, and each entry's import names
 * the project's renderer's package, which exports the same functions.
 */
export const THE_TICK_SHEET: CheatSheet = {
    id: 'the-tick',
    title: 'The tick',
    summary: "How a view writes the model's state every tick, and moves its own presentation state on. Import these from your renderer's package.",
    groups: [
        {
            title: 'A view tick by tick',
            entries: [
                {
                    name: 'setRefresh',
                    from: '@mvtjs/pixi',
                    signature: 'setRefresh(view: View, refresh: RefreshMethod | undefined): void',
                    useFor: "Give a view a refresh method, which writes the model's state to the view's display objects every tick.",
                    snippet: [
                        'const view = new Container();',
                        'const ball = new Graphics().circle(0, 0, 10).fill(0xffcc00);',
                        'view.addChild(ball);',
                        'setRefresh(view, () => {',
                        '    ball.position.set(bindings.x(), bindings.y());',
                        '});',
                        'return view;',
                    ].join('\n'),
                    chapter: 'chapters/07-views',
                },
                {
                    name: 'setUpdate',
                    from: '@mvtjs/pixi',
                    signature: 'setUpdate(view: View, update: UpdateMethod | undefined): void',
                    useFor: "Give a view an update method, which moves the view's own presentation state on by `deltaMs`, such as a flash that fades.",
                    snippet: [
                        'let flashMs = 0;',
                        'setUpdate(view, (deltaMs) => {',
                        '    flashMs = Math.max(0, flashMs - deltaMs);',
                        '});',
                        'setRefresh(view, () => {',
                        '    flash.alpha = flashMs / FLASH_MS;',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/11-presentation-state',
                },
                {
                    name: 'SKIP_DESCENDANTS',
                    from: '@mvtjs/pixi',
                    signature: 'const SKIP_DESCENDANTS: unique symbol',
                    useFor: "Return it from an update or refresh method to skip the view's children this tick, such as while the view is hidden.",
                    snippet: [
                        'setRefresh(view, () => {',
                        '    view.visible = bindings.isShown();',
                        '    if (!view.visible) return SKIP_DESCENDANTS;',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/07-views',
                },
            ],
        },
        {
            title: 'Running the views yourself',
            entries: [
                {
                    name: 'updateView',
                    from: '@mvtjs/pixi',
                    signature: 'updateView(view: View, deltaMs: number): void',
                    useFor: 'Call every update method in a tree of views. The playground calls it for you each tick, so you need it only in a loop of your own.',
                    chapter: 'chapters/07-views',
                },
                {
                    name: 'refreshView',
                    from: '@mvtjs/pixi',
                    signature: 'refreshView(view: View): void',
                    useFor: 'Call every refresh method in a tree of views, parents before children. The playground calls it for you each tick.',
                    chapter: 'chapters/07-views',
                },
                {
                    name: 'hasUpdate',
                    from: '@mvtjs/pixi',
                    signature: 'hasUpdate(view: View): boolean',
                    useFor: 'Check whether a view has an update method, such as in a test.',
                },
                {
                    name: 'hasRefresh',
                    from: '@mvtjs/pixi',
                    signature: 'hasRefresh(view: View): boolean',
                    useFor: 'Check whether a view has a refresh method, such as in a test.',
                },
                {
                    name: 'advanceTime',
                    from: '@mvtjs/pixi',
                    useFor: 'Move models and views on by some milliseconds in a test, a tick at a time, as the ticker would.',
                    snippet: [
                        'const model = createShipModel();',
                        'const view = ShipView({ model });',
                        'await advanceTime(500, model, view);',
                    ].join('\n'),
                    chapter: 'chapters/15-testing-models',
                },
            ],
        },
    ],
};
