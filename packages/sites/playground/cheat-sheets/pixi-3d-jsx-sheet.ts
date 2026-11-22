import type { CheatSheet } from './cheat-sheet';
import { JSX_ATTRIBUTE_ENTRIES } from './jsx-attribute-entries';

/** Views written in JSX for PixiJS 3D, and the views that put 3D in 2D and 2D in 3D. */
export const PIXI_3D_JSX_SHEET: CheatSheet = {
    id: 'pixi-3d-jsx',
    title: 'JSX in 3D',
    summary: 'Views of 3D scenes written as JSX, for PixiJS 3D on a Pixi stage. Start a `.tsx` file with `/** @jsxImportSource @mvtjs/pixi-3d */`.',
    renderers: ['pixi'],
    groups: [
        {
            title: '2D and 3D together',
            entries: [
                {
                    name: 'Scene3DView',
                    from: '@mvtjs/pixi-3d',
                    useFor: 'Show a 3D scene on the Pixi stage, drawn from the first `<camera>` in it. 2D views added after it draw on top.',
                    snippet: [
                        'stage.addChild(Scene3DView({',
                        '    scene: CrateSceneView({ progress: () => model.progress }),',
                        '    width: 400,',
                        '    height: 300,',
                        '    background: 0x1d2433,',
                        '}));',
                    ].join('\n'),
                },
                {
                    name: 'ScreenView',
                    from: '@mvtjs/pixi-3d',
                    useFor: 'Show a 2D view on a screen in the scene, such as a scoreboard over a track. The screen shows the view from the first frame.',
                    snippet: [
                        '<ScreenView content={ScoreView({ score: () => model.score })}',
                        '    contentWidth={256} contentHeight={64} width={4} height={1} />',
                    ].join('\n'),
                },
                {
                    name: 'ScreenAnchorView',
                    from: '@mvtjs/pixi-3d',
                    useFor: 'Place a 2D view over a point in the scene, such as a name tag over a car. It stays sharp, and draws over the scene.',
                },
            ],
        },
        {
            title: 'Elements',
            entries: [
                {
                    name: '<group>',
                    signature: '<group x={...} y={...} z={...} rotationX={...} rotationY={...} rotationZ={...} scale={...}>',
                    useFor: 'Group other nodes, and move, turn or scale them together. Every element takes these attributes. Rotations are in radians.',
                    snippet: [
                        '<group x={() => model.x} rotationY={() => model.heading}>',
                        '    <mesh geometry={hull} material={metal} />',
                        '</group>',
                    ].join('\n'),
                },
                {
                    name: '<mesh>',
                    signature: '<mesh geometry={...} material={...} castShadow={...} receiveShadow={...}>',
                    useFor: "Show a shape. Make each geometry and material once, in a variable, and list them in `owns` on the view's root element.",
                    snippet: [
                        'const box = new CubeGeometry({ width: 1, height: 1, depth: 1 });',
                        'const red = new Material3D({ baseColor: 0xff4040 });',
                        '',
                        '<group owns={[box, red]}>',
                        '    <mesh geometry={box} material={red} y={() => model.height} />',
                        '</group>',
                    ].join('\n'),
                },
                {
                    name: '<camera>',
                    signature: '<camera x={...} y={...} z={...} lookAt={...} fov={...}>',
                    useFor: 'Set where the scene is seen from. Write `lookAt` after the position, since attributes are applied in order. Keep one camera, outside any `<Switch>` or `<List>`, and move it.',
                    snippet: '<camera y={2} z={6} lookAt={{ x: 0, y: 0, z: 0 }} />',
                },
                {
                    name: '<ambientLight>, <directionalLight>, <pointLight> and <spotLight>',
                    signature: '<directionalLight color={...} intensity={...} castShadow={...} shadow={...} lookAt={...}>',
                    useFor: 'Light the scene, so a `Material3D` shows. A directional or spot light can cast shadows.',
                    snippet: [
                        '<ambientLight intensity={0.4} />',
                        '<directionalLight intensity={2.5} castShadow={true} x={-3} y={5} z={4} lookAt={{ x: 0, y: 0, z: 0 }} />',
                    ].join('\n'),
                },
                {
                    name: '<sprite3d>',
                    signature: '<sprite3d texture={...} width={...} height={...} billboardMode={...}>',
                    useFor: "Show a picture in the scene, which walls in front of it can hide. With `billboardMode='spherical'`, it always faces the camera.",
                },
                {
                    name: '<model>',
                    signature: '<model source={...} clip={...} clipTimeMs={...}>',
                    useFor: 'Show a 3D model loaded from a glTF file, posed at a moment in one of its animation clips. The pose changes only when `clipTimeMs` does.',
                },
                {
                    name: 'onPointerTap',
                    signature: 'onPointerTap={(event: Pointer3DEvent) => void}',
                    useFor: "Report a tap on a node, or on any node inside a group. `hitVolume='geometry'` tests each triangle, not the box around it.",
                },
            ],
        },
        {
            title: 'Particles, and freeing without JSX',
            entries: [
                {
                    name: 'ParticlesView',
                    from: '@mvtjs/pixi-3d',
                    useFor: 'Show particles, such as sparks or smoke. They move only as your views update, and start from a seed, so a run repeats exactly.',
                    snippet: [
                        '<ParticlesView',
                        '    options={{ emitRate: 0, life: [0.4, 0.8], speed: [2, 6], color: 0xffaa33 }}',
                        '    isEmitting={false}',
                        '    bursts={() => model.explosions}',
                        '/>',
                    ].join('\n'),
                },
                {
                    name: 'ownResources',
                    from: '@mvtjs/pixi-3d',
                    useFor: "Free a view's geometries, materials and textures when its node is destroyed, as `owns` does, in a view written without JSX.",
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
                    from: '@mvtjs/pixi-3d',
                    signature: '<List items={() => readonly T[]}>{(item: () => T, index: number) => view}</List>',
                    useFor: 'Show a node for each item in an array, such as each asteroid. The item is a getter.',
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Switch',
                    from: '@mvtjs/pixi-3d',
                    signature: '<Switch>{<Match> elements}</Switch>',
                    useFor: 'Show one of several views, whichever `<Match>` matches first.',
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Match',
                    from: '@mvtjs/pixi-3d',
                    signature: '<Match when={() => boolean}>\n<Match else>',
                    useFor: 'Give a `<Switch>` a branch, shown while its `when` is true, or as the last branch, `else`.',
                    chapter: 'chapters/14-lists-and-switches',
                },
            ],
        },
    ],
};
