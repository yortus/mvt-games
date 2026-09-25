import { Container } from 'pixi.js';
import { batch, createMemo, createRenderEffect, createRoot, createSignal } from 'solid-js';
import { watch } from '../../src/common';
import { refreshScene } from '../../src/pixi-mvt';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * 1000 Pixi containers reacting to state that changes only occasionally.
 *
 * scenario `discrete`: each model record has a `level`. When it changes, the
 *   view updates two properties from it. Approaches: `manual` (compare with the
 *   previous value by hand), `watch` (the repo's `watch()` helper), `events`,
 *   `solid`.
 * scenario `derived`: each view shows the sum of 8 model values. Approaches:
 *   `recompute` (sum all 8 every frame), `watch` (watch all 8, and sum only
 *   when one changed), `events`, `solid` (8 signals and a `createMemo`).
 *
 * Returns one frame: the model changes, then the view catches up.
 */
export function createChangeDetectionFrame(scenario: string, approach: string, changedPercent: number): () => void {
    const changedCount = Math.round((COUNT * changedPercent) / 100);
    return scenario === 'discrete' ? createDiscrete(approach, changedCount) : createDerived(approach, changedCount);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const COUNT = 1000;
const INPUTS = 8;

// ---------------------------------------------------------------------------
// Discrete state
// ---------------------------------------------------------------------------

interface LevelModel {
    level: number;
    listener?: (level: number) => void;
}

function applyLevel(view: Container, level: number): void {
    view.alpha = (level % 10) / 10;
    view.scale.set(1 + (level % 3));
}

function createDiscrete(approach: string, changedCount: number): () => void {
    const root = new Container();

    if (approach === 'solid') {
        const levels: [() => number, (value: number) => void][] = [];
        createRoot(() => {
            for (let i = 0; i < COUNT; i++) {
                const view = new Container();
                root.addChild(view);
                const [level, setLevel] = createSignal(0);
                levels.push([level, setLevel]);
                createRenderEffect(() => applyLevel(view, level()));
            }
        });
        const change = (): void => {
            for (let i = 0; i < changedCount; i++) levels[i][1](levels[i][0]() + 1);
        };
        return () => batch(change);
    }

    const items: LevelModel[] = [];
    for (let i = 0; i < COUNT; i++) {
        const item: LevelModel = { level: 0 };
        items.push(item);
        const view = new Container();
        root.addChild(view);
        applyLevel(view, 0);

        if (approach === 'events') {
            item.listener = (level) => applyLevel(view, level);
        }
        else if (approach === 'watch') {
            const watcher = watch({ level: () => item.level });
            view.onRefresh = () => {
                const w = watcher.poll();
                if (w.level.changed) applyLevel(view, w.level.value);
            };
        }
        else if (approach === 'manual') {
            let previous = item.level;
            view.onRefresh = () => {
                const level = item.level;
                if (level === previous) return;
                previous = level;
                applyLevel(view, level);
            };
        }
        else {
            throw new Error(`unknown approach: ${approach}`);
        }
    }

    const polled = approach !== 'events';
    return () => {
        for (let i = 0; i < changedCount; i++) {
            const item = items[i];
            item.level++;
            item.listener?.(item.level);
        }
        if (polled) refreshScene(root);
    };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

interface InputsModel {
    readonly inputs: number[];
    listener?: () => void;
}

function sum(values: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < values.length; i++) total += values[i];
    return total;
}

function createDerived(approach: string, changedCount: number): () => void {
    const root = new Container();

    if (approach === 'solid') {
        const firstInputs: [() => number, (value: number) => void][] = [];
        createRoot(() => {
            for (let i = 0; i < COUNT; i++) {
                const view = new Container();
                root.addChild(view);
                const getters: (() => number)[] = [];
                for (let k = 0; k < INPUTS; k++) {
                    const [input, setInput] = createSignal(k);
                    getters.push(input);
                    if (k === 0) firstInputs.push([input, setInput]);
                }
                const total = createMemo(() => {
                    let t = 0;
                    for (let k = 0; k < getters.length; k++) t += getters[k]();
                    return t;
                });
                createRenderEffect(() => {
                    view.x = total();
                });
            }
        });
        const change = (): void => {
            for (let i = 0; i < changedCount; i++) firstInputs[i][1](firstInputs[i][0]() + 1);
        };
        return () => batch(change);
    }

    const items: InputsModel[] = [];
    for (let i = 0; i < COUNT; i++) {
        const inputs: number[] = [];
        for (let k = 0; k < INPUTS; k++) inputs.push(k);
        const item: InputsModel = { inputs };
        items.push(item);
        const view = new Container();
        root.addChild(view);
        view.x = sum(inputs);

        if (approach === 'events') {
            item.listener = () => {
                view.x = sum(inputs);
            };
        }
        else if (approach === 'recompute') {
            view.onRefresh = () => {
                view.x = sum(inputs);
            };
        }
        else if (approach === 'watch') {
            const watcher = watch({
                i0: () => inputs[0],
                i1: () => inputs[1],
                i2: () => inputs[2],
                i3: () => inputs[3],
                i4: () => inputs[4],
                i5: () => inputs[5],
                i6: () => inputs[6],
                i7: () => inputs[7],
            });
            view.onRefresh = () => {
                const w = watcher.poll();
                if (w.i0.changed || w.i1.changed || w.i2.changed || w.i3.changed
                    || w.i4.changed || w.i5.changed || w.i6.changed || w.i7.changed) {
                    view.x = sum(inputs);
                }
            };
        }
        else {
            throw new Error(`unknown approach: ${approach}`);
        }
    }

    const polled = approach !== 'events';
    return () => {
        for (let i = 0; i < changedCount; i++) {
            const item = items[i];
            item.inputs[0]++;
            item.listener?.();
        }
        if (polled) refreshScene(root);
    };
}
