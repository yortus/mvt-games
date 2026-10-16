import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createPointerPicker, type PointerEventSource, type PointerLike, type PointerPickEvent } from './pointer-picker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A stand-in for a 100 x 100 canvas, recording listeners so a test can send events. */
function createCanvas() {
    const listeners: Record<string, ((event: PointerLike) => void)[]> = {};
    const canvas: PointerEventSource = {
        addEventListener: (type, listener) => void (listeners[type] ??= []).push(listener),
        removeEventListener: (type, listener) => {
            listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    };
    const send = (type: string, x: number, y: number): void => {
        for (const listener of listeners[type] ?? []) listener({ clientX: x, clientY: y });
    };
    return { canvas, send, listenerCount: () => Object.values(listeners).flat().length };
}

/** A camera looking at a unit box at the origin, inside a group, from z = 5. */
function setup(options: { readonly dragThreshold?: number } = {}) {
    const scene = new Scene();
    const group = new Group();
    const box = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    group.add(box);
    scene.add(group);
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 5;
    // The renderer updates world matrices each frame; there is no renderer here
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const { canvas, send, listenerCount } = createCanvas();
    const picker = createPointerPicker({ domElement: canvas, camera: () => camera, scene, ...options });
    const heard: string[] = [];
    const record = (name: string) => (event: PointerPickEvent) => void heard.push(`${name}:${event.type}`);
    return { scene, group, box, send, picker, heard, record, listenerCount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pointer picker', () => {
    it('dispatches a click on the object under the pointer, then on its ancestors', () => {
        const t = setup();
        t.box.addEventListener('click' as never, t.record('box') as never);
        t.group.addEventListener('click' as never, t.record('group') as never);

        t.send('click', 50, 50);
        t.send('click', 1, 1); // Misses the box

        expect(t.heard).toEqual(['box:click', 'group:click']);
    });

    it('stops at the handler that stops propagation', () => {
        const t = setup();
        t.box.addEventListener('click' as never, ((event: PointerPickEvent) => {
            t.heard.push('box');
            event.stopPropagation();
        }) as never);
        t.group.addEventListener('click' as never, t.record('group') as never);

        t.send('click', 50, 50);

        expect(t.heard).toEqual(['box']);
    });

    it('ignores objects that are hidden, or inside a hidden ancestor', () => {
        const t = setup();
        t.box.addEventListener('click' as never, t.record('box') as never);

        t.group.visible = false;
        t.send('click', 50, 50);

        expect(t.heard).toEqual([]);
    });

    it('dispatches pointerover and pointerout as the pointer moves onto and off an object', () => {
        const t = setup();
        for (const kind of ['pointerover', 'pointerout', 'pointermove']) {
            t.box.addEventListener(kind as never, t.record('box') as never);
        }

        t.send('pointermove', 50, 50);
        t.send('pointermove', 51, 50);
        t.send('pointermove', 1, 1);

        expect(t.heard).toEqual(['box:pointerover', 'box:pointermove', 'box:pointermove', 'box:pointerout']);
    });

    describe('with a drag threshold', () => {
        /** A press at (50, 50) over the box, moving through `path`, released and clicked where it ends. */
        function press(t: ReturnType<typeof setup>, path: readonly (readonly [number, number])[]): void {
            t.send('pointerdown', 50, 50);
            for (const [x, y] of path) t.send('pointermove', x, y);
            const [endX, endY] = path[path.length - 1] ?? [50, 50];
            t.send('pointerup', endX, endY);
            t.send('click', endX, endY);
        }

        it('drops the click of a press that moved too far, but still sends its down and up', () => {
            const t = setup({ dragThreshold: 5 });
            t.box.addEventListener('pointerdown' as never, t.record('box') as never);
            t.box.addEventListener('pointerup' as never, t.record('box') as never);
            t.box.addEventListener('click' as never, t.record('box') as never);

            // 8 pixels, and still over the box
            press(t, [[54, 50], [58, 50]]);

            expect(t.heard).toEqual(['box:pointerdown', 'box:pointerup']);
        });

        it('clicks on a press that only jittered', () => {
            const t = setup({ dragThreshold: 5 });
            t.box.addEventListener('click' as never, t.record('box') as never);

            press(t, [[52, 51], [53, 52]]);

            expect(t.heard).toEqual(['box:click']);
        });

        it('counts a press that went far and came back as a drag', () => {
            const t = setup({ dragThreshold: 5 });
            t.box.addEventListener('click' as never, t.record('box') as never);

            press(t, [[70, 50], [50, 50]]);

            expect(t.heard).toEqual([]);
        });

        it('starts each press afresh', () => {
            const t = setup({ dragThreshold: 5 });
            t.box.addEventListener('click' as never, t.record('box') as never);

            press(t, [[70, 50]]);
            press(t, [[51, 50]]);

            expect(t.heard).toEqual(['box:click']);
        });
    });

    it('clicks after a drag when given no drag threshold, as the DOM does', () => {
        const t = setup();
        t.box.addEventListener('click' as never, t.record('box') as never);

        t.send('pointerdown', 40, 50);
        t.send('pointermove', 60, 50);
        t.send('pointerup', 60, 50);
        t.send('click', 55, 50);

        expect(t.heard).toEqual(['box:click']);
    });

    it('removes its listeners when disposed', () => {
        const t = setup();

        t.picker.dispose();

        expect(t.listenerCount()).toBe(0);
    });
});
