// Reproduces an unexplained allocation: fractional numbers boxed, or not,
// depending on unrelated code. Not part of any suite.
//
// 1000 model records hold fractional `x`, `y` and `alpha`, changed every
// frame. With JSX views over them, the model's own writes allocate about 32
// bytes per record per frame; with hand-written views, nothing. The views are
// never refreshed, so the cost is in the model update alone.
//
//     node --expose-gc --import tsx packages/benchmarks/repro/fractional-boxing.ts [jsx | hand-written]
//
// The effect depends on the shape of the code around it, so change this file
// only to investigate; a tidier version may no longer reproduce it.

import { Container } from 'pixi.js';
import { allocationPerFrame } from '../harness/measure';
import { jsx, setRefresh } from '@mvtjs/pixi';

type ViewKind = 'jsx' | 'hand-written';

interface ItemModel {
    x: number;
    y: number;
    alpha: number;
}

interface ValueRules {
    readonly offset: number;
    readonly step: number;
    readonly startAlpha: number;
    alphaAt: (tick: number) => number;
}

const RULES: ValueRules = { offset: 0.25, step: 0.37, startAlpha: 0.75, alphaAt: (tick) => 0.3 + (tick % 64) / 91 };

// One kind per process, as the suites run: `jsx` (the default) or `hand-written`.
const kind: ViewKind = process.argv[2] === 'hand-written' ? 'hand-written' : 'jsx';
const frame = createScene(kind, 1000);
console.log(kind, Math.round(await allocationPerFrame(frame)), 'bytes per frame');

function createScene(kind: ViewKind, count: number): () => void {
    const items: ItemModel[] = [];
    for (let i = 0; i < count; i++) items.push({ x: i + RULES.offset, y: i + RULES.offset, alpha: RULES.startAlpha });
    const root = new Container();
    for (let i = 0; i < items.length; i++) root.addChild(createView(kind, items[i]));

    let tick = 0;
    return () => {
        tick++;
        changeItems(items, count, tick, RULES);
    };
}

function changeItems(items: ItemModel[], changedCount: number, tick: number, rules: ValueRules): void {
    const alpha = rules.alphaAt(tick);
    const step = rules.step;
    for (let i = 0; i < changedCount; i++) {
        const item = items[i];
        item.x += step;
        item.y += step;
        item.alpha = alpha;
    }
}

function createView(kind: ViewKind, item: ItemModel): Container {
    if (kind === 'jsx') {
        return jsx('container', { x: () => item.x, y: () => item.y, alpha: () => item.alpha });
    }
    const view = new Container();
    setRefresh(view, () => {
        view.x = item.x;
        view.y = item.y;
        view.alpha = item.alpha;
    });
    return view;
}
