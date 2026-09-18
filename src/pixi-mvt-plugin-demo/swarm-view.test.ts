import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { createSceneScheduler } from '../pixi-mvt-plugin';
import { createSwarmModel } from './swarm-model';
import { createSwarmView } from './swarm-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD = 1000;

function createScene(spawnRate: number, initialCount: number) {
    const swarm = createSwarmModel({ spawnRate, initialCount });
    const root = new Container();
    root.label = 'root';
    const view = createSwarmView({
        getEntities: () => swarm.entities,
        getFieldWidth: () => FIELD,
        getFieldHeight: () => FIELD,
    });
    root.addChild(view);
    const scheduler = createSceneScheduler(root);
    return { swarm, root, view, scheduler };
}

function tick(scene: ReturnType<typeof createScene>, deltaMs = 16): void {
    scene.swarm.update(deltaMs);
    scene.scheduler.update(deltaMs);
    scene.scheduler.refresh();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSwarmView', () => {
    it('keeps one child view per live entity', () => {
        const scene = createScene(60, 20);
        tick(scene);
        expect(scene.view.children.length).toBe(scene.swarm.entities.length);

        for (let i = 0; i < 40; i++) tick(scene);
        expect(scene.view.children.length).toBe(scene.swarm.entities.length);
    });

    it('positions a child on the tick it is created, not the tick after', () => {
        // This is the drain-the-tail guarantee. The parent creates children
        // from inside onRefresh, so without the drain they would sit at the
        // origin for one frame.
        const scene = createScene(0, 1);
        tick(scene);

        const child = scene.view.children[0] as Container;
        const entity = scene.swarm.entities[0];
        expect(child.position.x).toBeCloseTo(entity.x * FIELD, 5);
        expect(child.position.y).toBeCloseTo(entity.y * FIELD, 5);
        expect(child.position.x).not.toBe(0);
    });

    it('drops child views when their entities die', () => {
        const scene = createScene(0, 30);
        tick(scene);
        expect(scene.view.children.length).toBe(30);

        // Every entity's lifespan is under 4 seconds.
        for (let i = 0; i < 300; i++) tick(scene);

        expect(scene.swarm.entities.length).toBe(0);
        expect(scene.view.children.length).toBe(0);
    });

    it('advances entity presentation state through onUpdate', () => {
        const scene = createScene(0, 1);
        tick(scene);
        const child = scene.view.children[0] as Container;
        const firstScale = child.scale.x;

        // The pulse is driven purely by accumulated deltaMs, so stepping time
        // with the model frozen still changes the rendered scale.
        for (let i = 0; i < 12; i++) {
            scene.scheduler.update(16);
            scene.scheduler.refresh();
        }

        expect(child.scale.x).not.toBeCloseTo(firstScale, 6);
    });

    it('runs the parent before every child it manages', () => {
        const scene = createScene(40, 10);
        for (let i = 0; i < 5; i++) tick(scene);

        const order: string[] = [];
        scene.view.onRefresh = (() => {
            const original = scene.view.onRefresh;
            return () => {
                order.push('parent');
                original?.();
            };
        })();
        const children = scene.view.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i] as Container;
            const original = child.onRefresh;
            child.onRefresh = () => {
                order.push('child');
                original?.();
            };
        }

        scene.scheduler.refresh();

        expect(order[0]).toBe('parent');
        expect(order.indexOf('parent')).toBe(order.lastIndexOf('parent'));
        expect(order.length).toBeGreaterThan(1);
    });
});
