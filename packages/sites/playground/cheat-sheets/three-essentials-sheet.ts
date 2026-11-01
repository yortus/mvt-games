import type { CheatSheet } from './cheat-sheet';

/** The parts of three.js that a first 3D project needs. */
export const THREE_ESSENTIALS_SHEET: CheatSheet = {
    id: 'three-essentials',
    title: 'three.js essentials',
    summary: "The parts of three.js that a first 3D project needs: meshes, their shapes and materials, lights, and placing objects. three.js's own docs cover the rest.",
    renderers: ['three'],
    groups: [
        {
            title: 'Meshes',
            entries: [
                {
                    name: 'Mesh',
                    from: 'three',
                    signature: 'new Mesh(geometry?: BufferGeometry, material?: Material)',
                    useFor: 'Show a shape: a geometry, drawn with a material. Share geometries and materials between meshes.',
                    snippet: [
                        'const BOX = new BoxGeometry(1, 1, 1);',
                        'const SKIN = new MeshNormalMaterial();',
                        'const cube = new Mesh(BOX, SKIN);',
                        'scene.add(cube);',
                    ].join('\n'),
                },
                { name: 'BoxGeometry', from: 'three', useFor: 'Make a box, by its width, height and depth.' },
                { name: 'SphereGeometry', from: 'three', useFor: 'Make a sphere, by its radius. More segments make it smoother.' },
                { name: 'PlaneGeometry', from: 'three', useFor: 'Make a flat rectangle, such as a floor. Turn it to lie flat with `rotation.x = -Math.PI / 2`.' },
                {
                    name: 'MeshNormalMaterial',
                    from: 'three',
                    useFor: 'Colour a mesh by the way each face points. It needs no lights, so it suits a first try.',
                },
                {
                    name: 'MeshStandardMaterial',
                    from: 'three',
                    useFor: 'Colour a mesh, shaded by the lights in the scene: `{ color: 0x44aaff }`. Without a light it shows black.',
                },
                {
                    name: 'MeshBasicMaterial',
                    from: 'three',
                    useFor: 'Colour a mesh one flat colour, whatever the lights.',
                },
            ],
        },
        {
            title: 'Lights',
            entries: [
                { name: 'AmbientLight', from: 'three', useFor: 'Light every object evenly, from no direction, so shadowed sides aren\'t black.' },
                { name: 'DirectionalLight', from: 'three', useFor: 'Light the scene from one direction, as the sun does. Its position sets where it shines from.' },
            ],
        },
        {
            title: 'Placing objects',
            entries: [
                {
                    name: 'Group',
                    from: 'three',
                    signature: 'new Group()',
                    useFor: 'Hold other objects, and move, turn or scale them together. A view usually returns one.',
                },
                {
                    name: 'Object3D.add',
                    from: 'three',
                    signature: 'Object3D.add(...objects: Object3D[]): Object3D',
                    useFor: 'Add objects to a group, or to the scene your `start` is passed.',
                },
                {
                    name: 'Object3D.position',
                    from: 'three',
                    useFor: 'Place an object, relative to its parent: `position.set(x, y, z)`. The camera starts at z = 5, looking at the origin.',
                    snippet: 'ship.position.set(model.x, 0, model.z);',
                },
                {
                    name: 'Object3D.rotation',
                    from: 'three',
                    useFor: 'Turn an object about its x, y and z axes, in radians: `rotation.y = model.heading`.',
                },
                {
                    name: 'MathUtils.degToRad',
                    from: 'three',
                    useFor: 'Turn degrees into the radians that rotations take.',
                },
                {
                    name: 'Color',
                    from: 'three',
                    signature: 'new Color(color?: ColorRepresentation)',
                    useFor: "Make a colour, from a number such as `0xff8800` or a CSS name. A material's `color` is one.",
                },
            ],
        },
    ],
    moreAt: [
        { label: "three.js's docs", url: 'https://threejs.org/docs/' },
        { label: "three.js's manual", url: 'https://threejs.org/manual/' },
    ],
};
