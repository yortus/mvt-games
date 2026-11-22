import type { CheatSheet } from './cheat-sheet';

/** The parts of PixiJS 3D that a first 3D project needs. */
export const PIXI_3D_ESSENTIALS_SHEET: CheatSheet = {
    id: 'pixi-3d-essentials',
    title: 'PixiJS 3D essentials',
    summary: "The parts of PixiJS 3D that a first 3D project needs: shapes and materials, and freeing them. PixiJS 3D's own docs cover the rest.",
    renderers: ['pixi'],
    groups: [
        {
            title: 'Shapes',
            entries: [
                { name: 'CubeGeometry', from: '@pixi/3d', useFor: 'Make a box, by its width, height and depth.' },
                { name: 'SphereGeometry', from: '@pixi/3d', useFor: 'Make a sphere, by its radius. More segments make it smoother.' },
                { name: 'CylinderGeometry', from: '@pixi/3d', useFor: 'Make a cylinder or a cone, standing upright along the y axis, by its two radii and its height.' },
                { name: 'PlaneGeometry', from: '@pixi/3d', useFor: 'Make a flat rectangle that faces along the z axis. Turn it with `rotationX={-Math.PI / 2}` to lie flat, as a floor.' },
            ],
        },
        {
            title: 'Materials',
            entries: [
                {
                    name: 'Material3D',
                    from: '@pixi/3d',
                    useFor: 'Colour a mesh, shaded by the lights in the scene: `{ baseColor: 0x44aaff, roughness: 0.5 }`. Without a light it shows black.',
                    snippet: 'const paint = new Material3D({ baseColor: 0xe8452c, roughness: 0.35, metallic: 0.2 });',
                },
                {
                    name: 'FlatMaterial',
                    from: '@pixi/3d',
                    useFor: 'Colour a mesh evenly, whatever the lights, like a glowing sign: `{ baseColor: 0xffcc33 }`.',
                },
            ],
        },
        {
            title: 'Freeing what you make',
            entries: [
                {
                    name: 'owns',
                    signature: 'owns={[geometry, material, texture]}',
                    useFor: 'List the shapes, materials and textures that a view made, on its root element. Each one is freed when the element is destroyed.',
                    chapter: 'chapters/07-views',
                },
            ],
        },
    ],
    moreAt: [{ label: 'PixiJS 3D docs', url: 'https://pixijs.download/3d/release/docs/' }],
};
