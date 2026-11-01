import type { CheatSheet } from './cheat-sheet';
import { JSX_ATTRIBUTE_ENTRIES } from './jsx-attribute-entries';

/** Views written in JSX, for three.js. */
export const THREE_JSX_SHEET: CheatSheet = {
    id: 'three-jsx',
    title: 'JSX',
    summary: 'Views written as JSX, for three.js. Start a `.tsx` file with `/** @jsxImportSource @mvtjs/three */`.',
    renderers: ['three'],
    groups: [
        {
            title: 'Elements',
            entries: [
                {
                    name: '<group>',
                    signature: '<group x={...} y={...} z={...} rotationX={...} rotationY={...} rotationZ={...} scale={...}>',
                    useFor: 'Group other objects, and move, turn or scale them together. Every element takes these attributes.',
                    snippet: [
                        '<group x={() => model.x} rotationY={() => model.heading}>',
                        '    <mesh geometry={HULL} material={METAL} />',
                        '</group>',
                    ].join('\n'),
                },
                {
                    name: '<mesh>',
                    signature: '<mesh geometry={...} material={...}>',
                    useFor: 'Show a shape. Make each geometry and material once, outside the view, and share them between meshes.',
                    snippet: [
                        'const BOX = new BoxGeometry(1, 1, 1);',
                        'const RED = new MeshStandardMaterial({ color: 0xff4040 });',
                        '',
                        '<mesh geometry={BOX} material={RED} y={() => model.height} />',
                    ].join('\n'),
                },
                {
                    name: '<ambientLight>, <directionalLight> and <pointLight>',
                    signature: '<directionalLight color={...} intensity={...} x={...} y={...} z={...}>',
                    useFor: 'Light the scene, so a `MeshStandardMaterial` shows. A `MeshNormalMaterial` needs no light.',
                    snippet: [
                        '<ambientLight intensity={0.4} />',
                        '<directionalLight x={3} y={5} z={4} intensity={1.2} />',
                    ].join('\n'),
                },
                {
                    name: 'onClick',
                    signature: 'onClick={(event: PointerPickEvent) => void}',
                    useFor: 'Report a click on an object, or on any object inside a group. It needs a pointer picker, made once in `start`.',
                },
                {
                    name: 'createPointerPicker',
                    from: '@mvtjs/three',
                    useFor: "Make pointer events reach your objects' `onClick` and `onPointerDown` attributes. In the playground, the scene's canvas is the page's only one.",
                    snippet: [
                        'createPointerPicker({',
                        "    domElement: document.querySelector('canvas')!,",
                        '    camera: () => camera,',
                        '    scene,',
                        '});',
                    ].join('\n'),
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
                    from: '@mvtjs/three',
                    signature: '<List items={() => readonly T[]}>{(item: () => T, index: number) => view}</List>',
                    useFor: 'Show an object for each item in an array, such as each asteroid. The item is a getter.',
                    snippet: [
                        '<List items={() => model.rocks}>',
                        '    {(rock) => (',
                        '        <mesh geometry={ROCK} material={STONE} x={() => rock().x} />',
                        '    )}',
                        '</List>',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Switch',
                    from: '@mvtjs/three',
                    signature: '<Switch>{<Match> elements}</Switch>',
                    useFor: 'Show one of several views, whichever `<Match>` matches first.',
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Match',
                    from: '@mvtjs/three',
                    signature: '<Match when={() => boolean}>\n<Match else>',
                    useFor: 'Give a `<Switch>` a branch, shown while its `when` is true, or as the last branch, `else`.',
                    chapter: 'chapters/14-lists-and-switches',
                },
            ],
        },
    ],
};
