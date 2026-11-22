import { CubeGeometry, Material3D, type Mesh3D } from '@pixi/3d';
import { Texture, TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { jsx } from './jsx-runtime';
import { pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pixi3dTarget', () => {
    describe('releasing what a view owns', () => {
        it('frees a geometry with its buffers, and a texture with its source', () => {
            const geometry = new CubeGeometry();
            const source = new TextureSource({ width: 2, height: 2 });
            const texture = new Texture({ source });

            pixi3dTarget.release(geometry);
            pixi3dTarget.release(texture);

            // eslint-disable-next-line @mvtjs/no-null -- Pixi drops a destroyed geometry's buffers to `null`
            expect(geometry.buffers).toBe(null);
            expect(texture.destroyed).toBe(true);
            expect(source.destroyed).toBe(true);
        });

        it('frees a material but not its textures, which the view lists if it made them', () => {
            const texture = new Texture({ source: new TextureSource({ width: 2, height: 2 }) });
            const material = new Material3D({ baseColorTexture: texture });

            pixi3dTarget.release(material);

            expect(material.destroyed).toBe(true);
            expect(texture.destroyed).toBe(false);
        });

        it('lets the meshes that drew with a resource be destroyed after it', () => {
            const body = new CubeGeometry();
            const paint = new Material3D();
            const car = jsx('group', {
                owns: [body, paint],
                children: [jsx('mesh', { geometry: body, material: paint }), jsx('mesh', { geometry: body, material: paint })],
            });

            expect(() => pixi3dTarget.destroy(car)).not.toThrow();
        });

        it('keeps a shared part until the view that owns it is destroyed', () => {
            // A scene that makes one set of parts and passes it to every car, as a race's scene might
            const wheel = new CubeGeometry();
            const scene = jsx('group', { owns: [wheel] });
            const car = jsx('mesh', { geometry: wheel }) as Mesh3D;
            pixi3dTarget.append(scene, car);

            pixi3dTarget.destroy(car);
            expect(wheel.buffers).not.toBe(undefined);
            expect(wheel.buffers.length).toBeGreaterThan(0);

            pixi3dTarget.destroy(scene);
            // eslint-disable-next-line @mvtjs/no-null -- as above
            expect(wheel.buffers).toBe(null);
        });
    });

    describe('events', () => {
        it('makes a node with a listener pickable, unless an eventMode attribute sets another mode', () => {
            const tapped = jsx('mesh', { onPointerTap: () => undefined });
            const passive = jsx('mesh', { onPointerTap: () => undefined, eventMode: 'none' });

            expect(tapped.eventMode).toBe('static');
            expect(passive.eventMode).toBe('none');
        });
    });
});
