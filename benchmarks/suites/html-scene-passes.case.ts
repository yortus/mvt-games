import { jsx as htmlJsx, List as HtmlList } from '@mvtjs/html/jsx';
import { setTickMethods, SKIP_DESCENDANTS, tickScene as tickElements } from '@mvtjs/html';
import { jsx as threeJsx, List as ThreeList } from '@mvtjs/three/jsx';
import { tickScene as tickObjects } from '@mvtjs/three';
import type { Object3D } from 'three';
import { readParams, report, timeFrames } from '../harness/measure';

// Runs in headless Chrome, with a real DOM. Nothing is laid out or drawn: the
// page is never shown, and no refresh changes anything a layout would read.

// ---------------------------------------------------------------------------
// The memoised walk against a naive one
// ---------------------------------------------------------------------------

/**
 * Rows of ten elements (a row and nine cells) under one root. `all` gives
 * every element a method, `sparse` one in twenty, `churn` every element and a
 * cell added one frame and removed the next, which the memoised walk must
 * rebuild for each time.
 * Each method is its own closure, as a view's are.
 */
function walkScene(methods: string, count: number, walk: string): () => void {
    const root = document.createElement('div');
    document.body.append(root);
    let calls = 0;
    const method = (): undefined => {
        calls++;
        return undefined;
    };
    // Each walk gets only what it reads: the memoised walk the scene passes'
    // method, the naive walk a property of its own.
    const withMethod = (el: Element): void => {
        if (walk === 'memoised') setTickMethods(el, { refresh: () => method() });
        else (el as BaselineElement).baselineRefresh = () => method();
    };
    const rows = count / 10;
    for (let r = 0; r < rows; r++) {
        const row = document.createElement('div');
        root.append(row);
        if (methods !== 'sparse') withMethod(row);
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('span');
            row.append(cell);
            if (methods !== 'sparse' || (c === 0 && r % 2 === 0)) withMethod(cell);
        }
    }

    const churning = document.createElement('span');
    withMethod(churning);
    const churnRow = root.firstElementChild as Element;
    let isChurningAttached = false;
    const refresh = walk === 'memoised' ? refreshElements : naiveRefresh;
    return () => {
        if (methods === 'churn') {
            if (isChurningAttached) churning.remove();
            else churnRow.append(churning);
            isChurningAttached = !isChurningAttached;
        }
        refresh(root);
        // Keeps the methods' work observable, so none is optimised away
        if (calls < 0) throw new Error('unreachable');
    };
}

/** An element with the refresh method the naive walk keeps for itself, in a property of its own. */
type BaselineElement = Element & { baselineRefresh?: () => undefined };

/**
 * Every element's method, parents first, found afresh each frame by walking
 * the tree. What the memoised walk replaces.
 */
function naiveRefresh(node: BaselineElement): void {
    const method = node.baselineRefresh;
    if (method !== undefined && method() === SKIP_DESCENDANTS) return;
    for (let child = node.firstElementChild; child !== null; child = child.nextElementSibling) naiveRefresh(child);
}

/** The memoised walk: @mvtjs/html's refresh scene pass. */
function refreshElements(root: Element): void {
    tickElements({ root, only: 'refresh' });
}

/** @mvtjs/three's refresh scene pass. */
function refreshObjects(root: Object3D): void {
    tickObjects({ root, only: 'refresh' });
}

// ---------------------------------------------------------------------------
// Two targets in one page
// ---------------------------------------------------------------------------

interface Item {
    label: string;
    x: number;
    isShown: boolean;
}

const LIST_LENGTH = 1000;

function makeItems(): Item[] {
    const items: Item[] = [];
    for (let i = 0; i < LIST_LENGTH; i++) items.push({ label: `item ${i}`, x: i, isShown: true });
    return items;
}

/**
 * Advances the model: every item moves, and one in a hundred changes its
 * label, so the HTML list writes a little text each frame, as a HUD does.
 */
function stepItems(items: Item[], frame: number): void {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.x = (item.x + 1) % 997;
        if ((i + frame) % 100 === 0) item.label = item.label === 'hot' ? `item ${i}` : 'hot';
    }
}

/** A `<ul>` of `<li>`s, each binding its text and class to its item. */
function htmlListScene(): () => void {
    const items = makeItems();
    const root = htmlJsx('ul', {
        children: HtmlList<Item>({
            items,
            children: (item) => htmlJsx('li', {
                text: () => item().label,
                class: () => (item().label === 'hot' ? 'hot' : 'cold'),
                visible: () => item().isShown,
            }),
        }),
    });
    document.body.append(root);
    let frame = 0;
    return () => {
        stepItems(items, frame++);
        refreshElements(root);
    };
}

/** A group of groups, each binding its position and visibility to its item. */
function threeListScene(): () => void {
    const items = makeItems();
    const root = threeJsx('group', {
        children: ThreeList<Item>({
            items,
            children: (item) => threeJsx('group', {
                x: () => item().x,
                z: () => item().x * 0.5,
                visible: () => item().isShown,
            }),
        }),
    });
    let frame = 0;
    return () => {
        stepItems(items, frame++);
        refreshObjects(root);
    };
}

/**
 * The measured target's list, alone, or after the other target's list has
 * been built and refreshed for long enough to be optimised: the shared
 * `<List>` code, the scene-pass loop and the refresh builder have then seen
 * both targets' nodes and functions, as they do on a page that has both.
 */
function twoTargetsScene(measured: string, other: string): () => void {
    if (other === 'warmed') {
        const otherFrame = measured === 'html' ? threeListScene() : htmlListScene();
        for (let f = 0; f < 3000; f++) otherFrame();
    }
    return measured === 'html' ? htmlListScene() : threeListScene();
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const params = readParams();
const frame = params.scene === 'walk'
    ? walkScene(String(params.methods), Number(params.count), String(params.walk))
    : twoTargetsScene(String(params.measured), String(params.other));
report({ usPerFrame: timeFrames(frame) });
