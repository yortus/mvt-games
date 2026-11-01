import type { CheatSheet } from './cheat-sheet';
import { JSX_ATTRIBUTE_ENTRIES } from './jsx-attribute-entries';

/** Views written in JSX, for Pixi. */
export const PIXI_JSX_SHEET: CheatSheet = {
    id: 'pixi-jsx',
    title: 'JSX',
    summary: 'Views written as JSX, for Pixi. Start a `.tsx` file with `/** @jsxImportSource @mvtjs/pixi */`.',
    renderers: ['pixi'],
    groups: [
        {
            title: 'Elements',
            entries: [
                {
                    name: '<container>',
                    signature: '<container x={...} y={...} alpha={...} rotation={...} scale={...}>',
                    useFor: 'Group other elements, and move, fade, turn or scale them together. Every element takes these attributes.',
                    snippet: [
                        '<container x={() => model.x} y={() => model.y}>',
                        '    <graphics ref={drawShip} />',
                        '</container>',
                    ].join('\n'),
                },
                {
                    name: '<graphics>',
                    signature: '<graphics ref={(g: Graphics) => void} tint={...}>',
                    useFor: 'Draw shapes. Draw them once in `ref`, then move, scale or tint the element, rather than drawing again every tick.',
                    snippet: [
                        '<graphics',
                        '    ref={(g) => g.circle(0, 0, 10).fill(0xffffff)}',
                        '    tint={() => (model.isHurt ? 0xff4040 : 0xffffff)}',
                        '/>',
                    ].join('\n'),
                },
                {
                    name: '<text>',
                    signature: '<text text={...} style={{ fill, fontSize, ... }} anchor={...}>',
                    useFor: 'Show text, such as a score. Make the text with `createComputed`, so it changes only when the score does.',
                    snippet: [
                        '<text',
                        '    text={scoreText}',
                        '    style={{ fill: 0xffffff, fontSize: 18 }}',
                        '    anchor={0.5}',
                        '/>',
                    ].join('\n'),
                },
                {
                    name: '<sprite>',
                    signature: '<sprite texture={...} tint={...} anchor={...} width={...} height={...}>',
                    useFor: 'Show a texture, such as one you made by drawing a `Graphics`.',
                },
                {
                    name: 'onPointerTap',
                    signature: 'onPointerTap={(event: FederatedPointerEvent) => void}',
                    useFor: 'Report a click or tap on an element. Pixi has `onPointerDown`, `onPointerUp`, `onPointerMove` and the rest too.',
                    snippet: '<graphics ref={drawButton} onPointerTap={() => model.startNewRun()} />',
                },
            ],
        },
        {
            title: 'Attributes of every element',
            entries: JSX_ATTRIBUTE_ENTRIES,
        },
        {
            title: 'Lists and switches',
            entries: [
                {
                    name: 'List',
                    from: '@mvtjs/pixi',
                    signature: '<List items={() => readonly T[]}>{(item: () => T, index: number) => view}</List>',
                    useFor: 'Show a view for each item in an array, such as each enemy. The item is a getter, since an item view may show other items over time.',
                    snippet: [
                        '<List items={() => model.enemies}>',
                        '    {(enemy) => (',
                        '        <EnemyView x={() => enemy().x} y={() => enemy().y} />',
                        '    )}',
                        '</List>',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Switch',
                    from: '@mvtjs/pixi',
                    signature: '<Switch>{<Match> elements}</Switch>',
                    useFor: 'Show one of several views, such as a title screen or the game, whichever `<Match>` matches first.',
                    snippet: [
                        '<Switch>',
                        "    <Match when={() => model.phase === 'title'}>",
                        '        <TitleView />',
                        '    </Match>',
                        '    <Match else>',
                        '        <GameView model={model} />',
                        '    </Match>',
                        '</Switch>',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Match',
                    from: '@mvtjs/pixi',
                    signature: '<Match when={() => boolean}>\n<Match else>',
                    useFor: 'Give a `<Switch>` a branch, shown while its `when` is true, or as the last branch, `else`.',
                    chapter: 'chapters/14-lists-and-switches',
                },
            ],
        },
    ],
};
