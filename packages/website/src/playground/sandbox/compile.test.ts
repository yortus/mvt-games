import { type Container, Container as ContainerClass, Rectangle } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView, setRefresh, setUpdate } from '@mvtjs/pixi';
import { newProjectTemplate, presets } from '../presets';
import { jsxGlobals, transpile } from './compile';

describe('sandbox compile', () => {
    it('compiles every preset, model and view', () => {
        for (const preset of presets) {
            expect(() => transpile(preset.modelCode, 'model'), preset.id).not.toThrow();
            expect(() => transpile(preset.viewCode, 'view'), preset.id).not.toThrow();
        }
    });

    it('compiles JSX in view code to working views', () => {
        const model = { x: 5 };
        const js = transpile(`
            function createView(model: { x: number }): any {
                return (
                    <container x={() => model.x}>
                        <graphics />
                        <>
                            <container label="a" />
                            <container label="b" />
                        </>
                    </container>
                );
            }
        `, 'view');
        const createView = runView(js);

        const view = createView(model);
        refreshView(view);
        expect(view.x).toBe(5);
        expect(view.children.length).toBe(2);
        expect(view.children[1].children.map((c) => c.label)).toEqual(['a', 'b']);

        model.x = 7;
        refreshView(view);
        expect(view.x).toBe(7);
    });

    it('supports <List> with a function child', () => {
        const model = { items: [1, 2, 3] };
        const js = transpile(`
            function createView(model: any): any {
                return (
                    <List items={model.items}>
                        {(item: () => number) => <container x={() => item()} />}
                    </List>
                );
            }
        `, 'view');
        const view = runView(js)(model);
        refreshView(view);
        expect(view.children.map((c) => c.x)).toEqual([1, 2, 3]);
    });

    it('runs the Traffic Light (JSX) preset, whose lights follow the model', () => {
        const { model, view } = runPreset<{ phase: string; update: (deltaMs: number) => void }>('traffic-light-jsx');
        // Each LightView is [dim, lit]; the housing is child 0, then red, yellow, green.
        const isLit = (light: number): boolean => view.children[1 + light].children[1].visible;

        refreshView(view);
        expect(model.phase).toBe('green');
        expect([isLit(0), isLit(1), isLit(2)]).toEqual([false, false, true]);

        model.update(3000);
        refreshView(view);
        expect(model.phase).toBe('yellow');
        expect([isLit(0), isLit(1), isLit(2)]).toEqual([false, true, false]);
    });

    it('runs the Bouncing Ball (JSX) preset, whose ball and shadow follow the model', () => {
        const { model, view } = runPreset<{
            x: number;
            y: number;
            held: boolean;
            grab: (x: number, y: number) => void;
            update: (deltaMs: number) => void;
        }>('bouncing-ball-jsx');
        // Children: the shadow, then the ball's container of [free, held].
        const [shadow, ball] = view.children;

        refreshView(view);
        expect(ball.x).toBe(model.x);
        expect(ball.y).toBe(model.y);
        expect(shadow.x).toBe(model.x);

        model.update(100);
        refreshView(view);
        expect(ball.y).toBe(model.y);
        expect([ball.children[0].visible, ball.children[1].visible]).toEqual([true, false]);

        model.grab(model.x, model.y);
        refreshView(view);
        expect(model.held).toBe(true);
        expect([ball.children[0].visible, ball.children[1].visible]).toEqual([false, true]);
    });

    it('starts a new project from a model and view that run', () => {
        const globals = { ...jsxGlobals, Container: ContainerClass, setUpdate, setRefresh };
        const names = Object.keys(globals);
        const values = Object.values(globals);
        const createModel = new Function(...names, `${transpile(newProjectTemplate.modelCode, 'model')}\nreturn createModel;`)(...values);
        const createView = new Function(...names, `${transpile(newProjectTemplate.viewCode, 'view')}\nreturn createView;`)(...values);
        const model = createModel() as { update: (deltaMs: number) => void };
        const view = createView(model) as unknown;

        // The sandbox rejects a view that is not a Container.
        expect(view).toBeInstanceOf(ContainerClass);
        model.update(16);
        refreshView(view as Container);
    });

    it('leaves JSX out of model code', () => {
        expect(() => transpile('const a = <container />;', 'model')).toThrow();
    });
});

/** Run a preset's model and view as the sandbox does, with the globals they use in scope. */
function runPreset<M>(id: string): { model: M; view: Container } {
    const preset = presets.find((p) => p.id === id);
    if (preset === undefined) throw new Error(`preset missing: ${id}`);
    const globals = { ...jsxGlobals, Rectangle, setUpdate, setRefresh, setBackground: () => undefined };
    const names = Object.keys(globals);
    const values = Object.values(globals);
    const createModel = new Function(...names, `${transpile(preset.modelCode, 'model')}\nreturn createModel;`)(...values);
    const createView = new Function(...names, `${transpile(preset.viewCode, 'view')}\nreturn createView;`)(...values);
    const model = createModel() as M;
    return { model, view: createView(model) as Container };
}

/** Evaluate transpiled view code as the sandbox does, with the JSX globals in scope. */
function runView(js: string): (model: unknown) => Container {
    const names = Object.keys(jsxGlobals);
    const fn = new Function(...names, `${js}\nreturn createView;`) as (...args: unknown[]) => (model: unknown) => Container;
    return fn(...Object.values(jsxGlobals));
}
