import { Container } from 'pixi.js';
import { batch, createRenderEffect, createRoot, createSignal } from 'solid-js';
import { jsx } from '../../src/pixi-jsx';
import { refreshScene } from '../../src/pixi-mvt';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How the Pixi containers are kept in step with the model.
 *
 * - `model-only`: the model changes, and there is no view at all.
 * - `hand-written`: an `onRefresh` method per container reads the model and
 *   assigns its properties, run by `refreshScene`. What a compiler would emit.
 * - `jsx`: the same, built with this repo's JSX runtime from getter props.
 * - `solid`: the model's fields are Solid signals, and one render effect per
 *   container assigns its properties when they change.
 * - `events`: the model calls a listener per item after changing it, and the
 *   listener assigns the container's properties.
 * - `wasteful`: `hand-written`, plus the per-frame allocations the hot path
 *   rules warn against (a template string and an `array.map()`). Exists to
 *   prove that the allocation measurements can see allocation.
 */
export type Approach = 'model-only' | 'hand-written' | 'jsx' | 'solid' | 'events' | 'wasteful';

export interface SyncedSceneOptions {
    readonly approach: Approach;
    /** How many Pixi containers, each with its own model record. */
    readonly count: number;
    /**
     * 3: `x`, `y` and `alpha` all follow the model. 1: only `x` follows the
     * model, and `y` and `alpha` are set once at construction.
     */
    readonly dynamicProperties: 1 | 3;
    /** Share of the model records changed each frame, 0 to 100. */
    readonly changedPercent: number;
}

/** A model and a view of `count` Pixi containers, kept in step. */
export interface SyncedScene {
    readonly root: Container;
    /** One frame: the model changes, then the view catches up. */
    frame(): void;
    dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSyncedScene(options: SyncedSceneOptions): SyncedScene {
    const changedCount = Math.round((options.count * options.changedPercent) / 100);
    if (options.approach === 'solid') return createSolidScene(options, changedCount);
    if (options.approach === 'events') return createEventsScene(options, changedCount);
    return createPolledScene(options, changedCount);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ItemModel {
    x: number;
    y: number;
    alpha: number;
}

interface EventItemModel extends ItemModel {
    listener: (item: ItemModel) => void;
}

type Signal = [get: () => number, set: (value: number) => void];

function createItems(count: number): ItemModel[] {
    const items: ItemModel[] = [];
    for (let i = 0; i < count; i++) items.push({ x: i, y: i, alpha: 1 });
    return items;
}

/** Changes the first `changedCount` items: `x` moves, and `y` and `alpha` too when all three properties are dynamic. */
function changeItems(items: ItemModel[], changedCount: number, allDynamic: boolean, tick: number): void {
    const alpha = (tick & 1) ? 0.5 : 1;
    for (let i = 0; i < changedCount; i++) {
        const item = items[i];
        item.x += 1;
        if (allDynamic) {
            item.y += 1;
            item.alpha = alpha;
        }
    }
}

/** `model-only`, `hand-written`, `jsx` and `wasteful`: the view polls the model. */
function createPolledScene(options: SyncedSceneOptions, changedCount: number): SyncedScene {
    const items = createItems(options.count);
    const allDynamic = options.dynamicProperties === 3;
    const root = new Container();
    if (options.approach !== 'model-only') {
        for (let i = 0; i < items.length; i++) {
            root.addChild(createPolledView(options.approach, items[i], allDynamic));
        }
    }
    const refresh = options.approach !== 'model-only';

    let tick = 0;
    return {
        root,
        frame() {
            tick++;
            changeItems(items, changedCount, allDynamic, tick);
            if (refresh) refreshScene(root);
        },
        dispose() {
            root.destroy({ children: true });
        },
    };
}

function createPolledView(approach: Approach, item: ItemModel, allDynamic: boolean): Container {
    if (approach === 'jsx') {
        return allDynamic
            ? jsx('container', { x: () => item.x, y: () => item.y, alpha: () => item.alpha })
            : jsx('container', { x: () => item.x, y: 5, alpha: 0.5 });
    }

    const view = new Container();
    if (approach === 'wasteful') {
        view.onRefresh = () => {
            // Both allocate on every call: a new string, and a new array
            view.label = `item at ${item.x}`;
            const doubled = [item.x, item.y].map((value) => value * 2);
            view.x = doubled[0] / 2;
            view.y = doubled[1] / 2;
            view.alpha = item.alpha;
        };
    }
    else if (allDynamic) {
        view.onRefresh = () => {
            view.x = item.x;
            view.y = item.y;
            view.alpha = item.alpha;
        };
    }
    else {
        view.y = 5;
        view.alpha = 0.5;
        view.onRefresh = () => {
            view.x = item.x;
        };
    }
    return view;
}

/** The model calls a listener per changed item; nothing polls. */
function createEventsScene(options: SyncedSceneOptions, changedCount: number): SyncedScene {
    const allDynamic = options.dynamicProperties === 3;
    const root = new Container();
    const items: EventItemModel[] = [];
    for (let i = 0; i < options.count; i++) {
        const view = new Container();
        root.addChild(view);
        let listener: (item: ItemModel) => void;
        if (allDynamic) {
            listener = (item) => {
                view.x = item.x;
                view.y = item.y;
                view.alpha = item.alpha;
            };
        }
        else {
            view.y = 5;
            view.alpha = 0.5;
            listener = (item) => {
                view.x = item.x;
            };
        }
        const item: EventItemModel = { x: i, y: i, alpha: 1, listener };
        listener(item);
        items.push(item);
    }

    let tick = 0;
    return {
        root,
        frame() {
            tick++;
            const alpha = (tick & 1) ? 0.5 : 1;
            for (let i = 0; i < changedCount; i++) {
                const item = items[i];
                item.x += 1;
                if (allDynamic) {
                    item.y += 1;
                    item.alpha = alpha;
                }
                // One notification per item per frame, after all its writes
                item.listener(item);
            }
        },
        dispose() {
            root.destroy({ children: true });
        },
    };
}

/** The model's fields are signals, and one render effect per container applies them. */
function createSolidScene(options: SyncedSceneOptions, changedCount: number): SyncedScene {
    const allDynamic = options.dynamicProperties === 3;
    const root = new Container();
    const xs: Signal[] = [];
    const ys: Signal[] = [];
    const alphas: Signal[] = [];

    // Built inside a root but run outside it: inside the root's own body,
    // Solid defers every effect until the body returns.
    const disposeRoot = createRoot((dispose) => {
        for (let i = 0; i < options.count; i++) {
            const view = new Container();
            root.addChild(view);
            const [x, setX] = createSignal(i);
            xs.push([x, setX]);
            if (allDynamic) {
                const [y, setY] = createSignal(i);
                const [alpha, setAlpha] = createSignal(1);
                ys.push([y, setY]);
                alphas.push([alpha, setAlpha]);
                // One render effect per container, as Solid's compiler groups
                // an element's dynamic attributes
                createRenderEffect(() => {
                    view.x = x();
                    view.y = y();
                    view.alpha = alpha();
                });
            }
            else {
                view.y = 5;
                view.alpha = 0.5;
                createRenderEffect(() => {
                    view.x = x();
                });
            }
        }
        return dispose;
    });

    // Fail rather than time writes whose effects never run: the server build,
    // or writes that Solid defers
    if (options.count > 0) {
        const probe = root.children[0];
        batch(() => xs[0][1](-1));
        if (probe.x !== -1) throw new Error('solid-js effects did not run');
        batch(() => xs[0][1](0));
    }

    let tick = 0;
    const change = (): void => {
        const alpha = (tick & 1) ? 0.5 : 1;
        for (let i = 0; i < changedCount; i++) {
            xs[i][1](xs[i][0]() + 1);
            if (allDynamic) {
                ys[i][1](ys[i][0]() + 1);
                alphas[i][1](alpha);
            }
        }
    };
    return {
        root,
        frame() {
            tick++;
            batch(change);
        },
        dispose() {
            disposeRoot();
            root.destroy({ children: true });
        },
    };
}
