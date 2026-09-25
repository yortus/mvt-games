import { Container } from 'pixi.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { refreshScene, updateScene } from './scene-passes';
import { SKIP_DESCENDANTS } from './mvt-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The two passes are the same algorithm against different fields, so the core
 * suite runs against both through this adapter.
 */
interface Driver {
    readonly kind: 'update' | 'refresh';
    assign(container: Container, fn: () => void): void;
    clear(container: Container): void;
    run(node: Container): void;
}

const drivers: Driver[] = [
    {
        kind: 'update',
        assign: (container, fn) => {
            container.onUpdate = fn;
        },
        clear: (container) => {
            container.onUpdate = undefined;
        },
        run: (node) => updateScene(node, 16),
    },
    {
        kind: 'refresh',
        assign: (container, fn) => {
            container.onRefresh = fn;
        },
        clear: (container) => {
            container.onRefresh = undefined;
        },
        run: (node) => refreshScene(node),
    },
];

interface Recorder {
    readonly calls: string[];
    clear(): void;
}

function createRecorder(): Recorder {
    const calls: string[] = [];
    return {
        calls,
        clear() {
            calls.length = 0;
        },
    };
}

function container(label: string): Container {
    const created = new Container();
    created.label = label;
    return created;
}

/** A container whose method of the driven kind records that it ran. */
function node(label: string, driver: Driver, rec: Recorder): Container {
    const created = container(label);
    driver.assign(created, () => rec.calls.push(label));
    return created;
}

/**
 * The contract: every container runs before any of its descendants, and exactly
 * once. Sibling order is explicitly not asserted anywhere in this file.
 */
function expectAncestorsFirst(order: readonly string[], root: Container): void {
    const parents = parentMap(root);
    const position = new Map<string, number>();
    for (let i = 0; i < order.length; i++) {
        expect(position.has(order[i]), `${order[i]} ran twice`).toBe(false);
        position.set(order[i], i);
    }
    for (let i = 0; i < order.length; i++) {
        let ancestor = parents.get(order[i]);
        while (ancestor !== undefined) {
            const at = position.get(ancestor);
            if (at !== undefined) {
                expect(at, `${ancestor} must run before its descendant ${order[i]}`).toBeLessThan(i);
            }
            ancestor = parents.get(ancestor);
        }
    }
}

function parentMap(root: Container): Map<string, string | undefined> {
    const map = new Map<string, string | undefined>();
    walk(root, undefined);
    return map;

    function walk(current: Container, parentLabel: string | undefined): void {
        map.set(current.label, parentLabel);
        const children = current.children;
        for (let i = 0; i < children.length; i++) {
            walk(children[i], current.label);
        }
    }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

describe.each(drivers)('$kind pass', (driver) => {
    let rec: Recorder;

    beforeEach(() => {
        rec = createRecorder();
    });

    it('calls every method in the subtree exactly once', () => {
        const root = node('root', driver, rec);
        const a = node('a', driver, rec);
        const b = node('b', driver, rec);
        const a1 = node('a1', driver, rec);
        a.addChild(a1);
        root.addChild(a, b);

        driver.run(root);

        expect([...rec.calls].sort()).toEqual(['a', 'a1', 'b', 'root']);
    });

    it('calls a container before its descendants', () => {
        const root = node('root', driver, rec);
        const a = node('a', driver, rec);
        const b = node('b', driver, rec);
        const a1 = node('a1', driver, rec);
        const a2 = node('a2', driver, rec);
        a.addChild(a1, a2);
        root.addChild(a, b);

        driver.run(root);

        expectAncestorsFirst(rec.calls, root);
    });

    it('calls an ancestor given an onUpdate or onRefresh after its descendants were listed before it', () => {
        // The hole `onRender` has: its registration list is append-only, so
        // giving an already-attached ancestor an `onRender` places it after its own
        // descendants.
        const root = node('root', driver, rec);
        const parent = container('parent');
        const child = node('child', driver, rec);
        parent.addChild(child);
        root.addChild(parent);

        driver.run(root);
        expect(rec.calls).toEqual(['root', 'child']);

        rec.clear();
        driver.assign(parent, () => rec.calls.push('parent'));
        driver.run(root);

        expectAncestorsFirst(rec.calls, root);
        expect(rec.calls.indexOf('parent')).toBeLessThan(rec.calls.indexOf('child'));
    });

    it('can be driven from any container', () => {
        const root = node('root', driver, rec);
        const branch = node('branch', driver, rec);
        const leaf = node('leaf', driver, rec);
        branch.addChild(leaf);
        root.addChild(branch);

        driver.run(root);
        expect([...rec.calls].sort()).toEqual(['branch', 'leaf', 'root']);

        rec.clear();
        driver.run(branch);
        expect([...rec.calls].sort()).toEqual(['branch', 'leaf']);

        rec.clear();
        driver.run(root);
        expect([...rec.calls].sort()).toEqual(['branch', 'leaf', 'root']);
    });

    it('stays correct when overlapping containers are driven alternately', () => {
        // The regression test for the ownership bug in the previous design: a
        // second caller stole the containers from the first, which then stopped
        // calling them forever, silently.
        const root = node('root', driver, rec);
        const branch = node('branch', driver, rec);
        const leaf = node('leaf', driver, rec);
        branch.addChild(leaf);
        root.addChild(branch);

        for (let i = 0; i < 5; i++) {
            rec.clear();
            driver.run(branch);
            expect([...rec.calls].sort(), `branch pass ${i}`).toEqual(['branch', 'leaf']);

            rec.clear();
            driver.run(root);
            expect([...rec.calls].sort(), `root pass ${i}`).toEqual(['branch', 'leaf', 'root']);
        }
    });

    it('ignores methods outside the driven subtree', () => {
        const root = node('root', driver, rec);
        const outsider = node('outsider', driver, rec);
        const holder = container('holder');
        holder.addChild(root, outsider);

        driver.run(root);

        expect(rec.calls).toEqual(['root']);
    });

    it('stays correct across 20 frames of churn', () => {
        const root = node('root', driver, rec);
        const branches: Container[] = [root];
        for (let i = 0; i < 4; i++) {
            const branch = node(`branch${i}`, driver, rec);
            root.addChild(branch);
            branches.push(branch);
        }

        const leaves: Container[] = [];
        for (let frame = 0; frame < 20; frame++) {
            if (leaves.length > 2) leaves.splice(0, 1)[0].removeFromParent();
            const leaf = node(`leaf${frame}`, driver, rec);
            branches[frame % branches.length].addChild(leaf);
            leaves.push(leaf);

            rec.clear();
            driver.run(root);

            expectAncestorsFirst(rec.calls, root);
            expect(rec.calls.length, `frame ${frame}`).toBe(5 + leaves.length);
        }
    });

    it('drops a detached container', () => {
        const root = node('root', driver, rec);
        const branch = node('branch', driver, rec);
        const leaf = node('leaf', driver, rec);
        branch.addChild(leaf);
        root.addChild(branch);

        driver.run(root);
        rec.clear();
        root.removeChild(branch);
        driver.run(root);

        expect(rec.calls).toEqual(['root']);
    });

    it('drops a container whose method is cleared', () => {
        const root = node('root', driver, rec);
        const child = node('child', driver, rec);
        root.addChild(child);

        driver.run(root);
        rec.clear();
        driver.clear(child);
        driver.run(root);

        expect(rec.calls).toEqual(['root']);
    });

    it('keeps its own list valid when a container is reparented', () => {
        const root = node('root', driver, rec);
        const left = node('left', driver, rec);
        const right = node('right', driver, rec);
        const movable = node('movable', driver, rec);
        const cargo = node('cargo', driver, rec);
        movable.addChild(cargo);
        left.addChild(movable);
        root.addChild(left, right);

        driver.run(root);
        rec.clear();
        right.addChild(movable);
        driver.run(root);

        expectAncestorsFirst(rec.calls, root);
        expect(rec.calls.length).toBe(5);
    });

    it('does not list a container twice after addChildAt, which bypasses removeChild', () => {
        const root = node('root', driver, rec);
        const left = node('left', driver, rec);
        const right = node('right', driver, rec);
        const movable = node('movable', driver, rec);
        left.addChild(movable);
        root.addChild(left, right);

        driver.run(root);
        rec.clear();
        right.addChildAt(movable, 0);
        driver.run(root);

        expectAncestorsFirst(rec.calls, root);
        expect(rec.calls.length).toBe(4);
    });

    it('survives sibling reordering, which carries no guarantee', () => {
        const root = node('root', driver, rec);
        const a = node('a', driver, rec);
        const b = node('b', driver, rec);
        const c = node('c', driver, rec);
        root.addChild(a, b, c);

        driver.run(root);
        rec.clear();
        root.swapChildren(a, c);
        root.addChild(b); // moves b to the end
        root.sortChildren();
        driver.run(root);

        expectAncestorsFirst(rec.calls, root);
        expect(rec.calls.length).toBe(4);
    });

    it('prunes subtrees in which no container has an onUpdate or onRefresh', () => {
        const root = container('root');
        const active: Container[] = [];
        // 200 branches of 100 containers each. Only every tenth branch has
        // containers with the pass's method (10 leaves): 20k containers, 200 of
        // which are ever called.
        for (let branchIndex = 0; branchIndex < 200; branchIndex++) {
            const branch = container(`branch${branchIndex}`);
            root.addChild(branch);
            let cursor: Container = branch;
            for (let depth = 0; depth < 99; depth++) {
                const child = container(`branch${branchIndex}-${depth}`);
                cursor.addChild(child);
                cursor = child;
            }
            if (branchIndex % 10 !== 0) continue;
            for (let i = 0; i < 10; i++) {
                const leaf = node(`leaf${branchIndex}-${i}`, driver, rec);
                cursor.addChild(leaf);
                active.push(leaf);
            }
        }

        driver.run(root);

        expect(active.length).toBe(200);
        expect(rec.calls.length).toBe(200);
    });

    it('still invalidates when a method is reassigned after the mixin installed', () => {
        // Regression for the accessor-shadowing defect: a method assigned before
        // the mixin was installed used to create an own data property, and
        // every later assignment then bypassed the setter.
        const root = node('root', driver, rec);
        const parent = container('parent');
        root.addChild(parent);

        driver.assign(parent, () => rec.calls.push('early'));
        driver.clear(parent);
        driver.run(root);
        expect(rec.calls).toEqual(['root']);

        rec.clear();
        driver.assign(parent, () => rec.calls.push('parent'));
        driver.run(root);

        expect(rec.calls).toEqual(['root', 'parent']);
    });

    it('leaves the other pass untouched when a method is assigned', () => {
        const root = node('root', driver, rec);
        const child = container('child');
        root.addChild(child);

        driver.run(root);
        const other = drivers.find((candidate) => candidate !== driver);
        expect(other).toBeDefined();

        rec.clear();
        // Assigning the other kind of method must not invalidate this kind's list.
        other?.assign(child, () => rec.calls.push('other'));
        driver.run(root);
        expect(rec.calls).toEqual(['root']);

        rec.clear();
        other?.run(root);
        expect(rec.calls).toEqual(['other']);
    });

    it('throws when a method drives the pass it is already inside', () => {
        const root = container('root');
        driver.assign(root, () => {
            rec.calls.push('root');
            driver.run(root);
        });

        expect(() => driver.run(root)).toThrow(/re-entrantly/);
        // The guard left nothing behind: a later pass still runs.
        rec.clear();
        driver.clear(root);
        driver.assign(root, () => rec.calls.push('root'));
        driver.run(root);
        expect(rec.calls).toEqual(['root']);
    });

    it('allows a method to drive a different container', () => {
        const root = container('root');
        const sub = node('sub', driver, rec);
        const subChild = node('subChild', driver, rec);
        sub.addChild(subChild);
        driver.assign(root, () => {
            rec.calls.push('root');
            driver.run(sub);
        });

        driver.run(root);

        expect(rec.calls).toEqual(['root', 'sub', 'subChild']);
    });
});

// ---------------------------------------------------------------------------
// Pass-specific behaviour
// ---------------------------------------------------------------------------

describe('updateScene', () => {
    it('passes deltaMs through to every method', () => {
        const deltas: number[] = [];
        const root = new Container();
        const child = new Container();
        root.addChild(child);
        root.onUpdate = (deltaMs) => void deltas.push(deltaMs);
        child.onUpdate = (deltaMs) => void deltas.push(deltaMs);

        updateScene(root, 16.5);

        expect(deltas).toEqual([16.5, 16.5]);
    });
});

describe('refreshScene', () => {
    it('is idempotent across three consecutive passes', () => {
        const root = new Container();
        const child = new Container();
        root.addChild(child);
        let angle = 0;
        root.onUpdate = (deltaMs) => {
            angle += deltaMs * 0.001;
        };
        child.onRefresh = () => {
            child.rotation = angle;
            child.alpha = 0.5;
        };

        updateScene(root, 500);
        refreshScene(root);
        const after = { rotation: child.rotation, alpha: child.alpha };
        refreshScene(root);
        refreshScene(root);

        expect({ rotation: child.rotation, alpha: child.alpha }).toEqual(after);
    });

    it('runs after every update when the caller orders the frame that way', () => {
        const order: string[] = [];
        const root = new Container();
        const a = new Container();
        const b = new Container();
        root.addChild(a, b);
        const all = [root, a, b];
        for (let i = 0; i < all.length; i++) {
            const current = all[i];
            current.label = `n${i}`;
            current.onUpdate = () => void order.push(`update:${current.label}`);
            current.onRefresh = () => void order.push(`refresh:${current.label}`);
        }

        updateScene(root, 16);
        refreshScene(root);

        expect(order.filter((entry) => entry.startsWith('update:')).length).toBe(3);
        expect(order[2].startsWith('update:')).toBe(true);
        expect(order[3].startsWith('refresh:')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// SKIP_DESCENDANTS
// ---------------------------------------------------------------------------

describe('SKIP_DESCENDANTS', () => {
    it('skips a container\'s descendants when its method returns the sentinel', () => {
        const calls: string[] = [];
        const root = new Container();
        const gate = new Container();
        const child = new Container();
        gate.addChild(child);
        root.addChild(gate);
        root.onRefresh = () => void calls.push('root');
        gate.onRefresh = () => {
            calls.push('gate');
            return SKIP_DESCENDANTS;
        };
        child.onRefresh = () => void calls.push('child');

        refreshScene(root);

        expect(calls).toEqual(['root', 'gate']); // the gate ran; its child did not
    });

    it('skips a deep descendant subtree, not just direct children', () => {
        const calls: string[] = [];
        const root = new Container();
        const gate = new Container();
        const child = new Container();
        const grandchild = new Container();
        child.addChild(grandchild);
        gate.addChild(child);
        root.addChild(gate);
        gate.onRefresh = () => SKIP_DESCENDANTS;
        child.onRefresh = () => void calls.push('child');
        grandchild.onRefresh = () => void calls.push('grandchild');

        refreshScene(root);

        expect(calls).toEqual([]);
    });

    it('lets a container that skipped itself recover on a later pass', () => {
        // The gate ran and only skipped its subtree, so nothing gets stuck: it
        // decides afresh every pass, with no rebuild.
        const calls: string[] = [];
        const root = new Container();
        const child = new Container();
        root.addChild(child);
        let open = false;
        root.onRefresh = () => (open ? undefined : SKIP_DESCENDANTS);
        child.onRefresh = () => void calls.push('child');

        refreshScene(root);
        expect(calls).toEqual([]);

        open = true;
        refreshScene(root);
        expect(calls).toEqual(['child']);
    });

    it('skips descendants in the update pass too', () => {
        const calls: string[] = [];
        const root = new Container();
        const frozen = new Container();
        const child = new Container();
        frozen.addChild(child);
        root.addChild(frozen);
        root.onUpdate = () => void calls.push('root');
        frozen.onUpdate = () => SKIP_DESCENDANTS;
        child.onUpdate = () => void calls.push('child');

        updateScene(root, 16);

        expect(calls).toEqual(['root']); // the frozen subtree did not advance
    });

    it('never prunes the container a pass is driven from', () => {
        // The driven root returning the sentinel skips its descendants, but the
        // root itself always runs - it is the entry point.
        const calls: string[] = [];
        const root = new Container();
        const child = new Container();
        root.addChild(child);
        root.onRefresh = () => {
            calls.push('root');
            return SKIP_DESCENDANTS;
        };
        child.onRefresh = () => void calls.push('child');

        refreshScene(root);

        expect(calls).toEqual(['root']);
    });
});

// ---------------------------------------------------------------------------
// Visibility does not gate
// ---------------------------------------------------------------------------

describe('visibility', () => {
    it('does not affect either pass', () => {
        const calls: string[] = [];
        const root = new Container();
        const hidden = new Container();
        const child = new Container();
        hidden.addChild(child);
        root.addChild(hidden);
        root.onRefresh = () => void calls.push('root');
        hidden.onRefresh = () => void calls.push('hidden');
        child.onRefresh = () => void calls.push('child');

        hidden.visible = false;
        refreshScene(root);

        expect([...calls].sort()).toEqual(['child', 'hidden', 'root']);
    });

    it('lets a view set its own `visible` without getting stuck', () => {
        // Nothing gates on visibility, so a self-hiding view still refreshes and
        // can reveal itself again. The old design forbade this; now it is free.
        const calls: string[] = [];
        const root = new Container();
        root.onRefresh = () => {
            root.visible = false;
            calls.push('root');
        };

        expect(() => refreshScene(root)).not.toThrow();
        refreshScene(root);
        expect(calls).toEqual(['root', 'root']);
    });
});

// ---------------------------------------------------------------------------
// Mid-pass mutation
// ---------------------------------------------------------------------------

describe('mutation during a pass', () => {
    let rec: Recorder;

    beforeEach(() => {
        rec = createRecorder();
    });

    it('runs a container added by a method from the next pass, not this one', () => {
        const root = container('root');
        let spawned = false;
        root.onRefresh = () => {
            rec.calls.push('root');
            if (spawned) return;
            spawned = true;
            const child = container('child');
            child.onRefresh = () => void rec.calls.push('child');
            root.addChild(child);
        };

        refreshScene(root);
        expect(rec.calls).toEqual(['root']);

        rec.clear();
        refreshScene(root);
        expect(rec.calls).toEqual(['root', 'child']);
    });

    it('skips a container removed earlier in the same pass', () => {
        const root = container('root');
        const first = container('first');
        const doomed = container('doomed');
        root.addChild(first, doomed);
        doomed.onRefresh = () => void rec.calls.push('doomed');
        first.onRefresh = () => {
            rec.calls.push('first');
            root.removeChild(doomed);
        };

        refreshScene(root);

        expect(rec.calls).toEqual(['first']);
    });

    it('is unaffected by removing a container that already ran', () => {
        const root = container('root');
        const early = container('early');
        const later = container('later');
        root.addChild(early, later);
        early.onRefresh = () => void rec.calls.push('early');
        later.onRefresh = () => {
            rec.calls.push('later');
            root.removeChild(early);
        };

        refreshScene(root);
        expect(rec.calls).toEqual(['early', 'later']);

        rec.clear();
        refreshScene(root);
        expect(rec.calls).toEqual(['later']);
    });

    it('skips a container whose method is cleared earlier in the same pass', () => {
        const root = container('root');
        const first = container('first');
        const silenced = container('silenced');
        root.addChild(first, silenced);
        silenced.onRefresh = () => void rec.calls.push('silenced');
        first.onRefresh = () => {
            rec.calls.push('first');
            silenced.onRefresh = undefined;
        };

        refreshScene(root);

        expect(rec.calls).toEqual(['first']);
    });

    it('calls a container reparented mid-pass once, from its snapshot position', () => {
        const root = container('root');
        const left = container('left');
        const right = container('right');
        const movable = container('movable');
        left.addChild(movable);
        root.addChild(left, right);
        movable.onRefresh = () => void rec.calls.push('movable');
        right.onRefresh = () => void rec.calls.push('right');
        left.onRefresh = () => {
            rec.calls.push('left');
            right.addChild(movable);
        };

        refreshScene(root);

        expect(rec.calls).toEqual(['left', 'movable', 'right']);
    });

    it('skips a container destroyed earlier in the same pass', () => {
        const root = container('root');
        const first = container('first');
        const doomed = container('doomed');
        const cargo = container('cargo');
        doomed.addChild(cargo);
        root.addChild(first, doomed);
        doomed.onRefresh = () => void rec.calls.push('doomed');
        cargo.onRefresh = () => void rec.calls.push('cargo');
        first.onRefresh = () => {
            rec.calls.push('first');
            doomed.destroy();
        };

        refreshScene(root);

        expect(rec.calls).toEqual(['first']);
    });

    it('stops calling a destroyed container that is driven directly', () => {
        const root = container('root');
        root.onRefresh = () => void rec.calls.push('root');

        refreshScene(root);
        expect(rec.calls).toEqual(['root']);

        rec.clear();
        root.destroy();
        refreshScene(root);
        expect(rec.calls).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Own-property shadowing
// ---------------------------------------------------------------------------

describe('shadowed methods', () => {
    it('throws in dev when a method is defined as an own property', () => {
        const root = new Container();
        const child = new Container();
        child.label = 'child';
        root.addChild(child);
        // What an assignment made before the mixin installed used to leave
        // behind, and what the eager install now prevents.
        Object.defineProperty(child, 'onRefresh', {
            value: () => {},
            writable: true,
            configurable: true,
        });

        expect(() => refreshScene(root)).toThrow(/own property/);
    });
});

// ---------------------------------------------------------------------------
// Differential test
// ---------------------------------------------------------------------------

describe('against a naive walk', () => {
    /** Deterministic PRNG so a failure is reproducible. */
    function createRandom(seed: number): () => number {
        let state = seed >>> 0;
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 0x100000000;
        };
    }

    /** What the memoised pass has to agree with, in preorder. */
    function naiveWalk(root: Container, out: string[]): void {
        if (root.onRefresh !== undefined) out.push(root.label);
        const children = root.children;
        for (let i = 0; i < children.length; i++) {
            naiveWalk(children[i], out);
        }
    }

    function isAncestorOf(maybeAncestor: Container, current: Container): boolean {
        // `Container.parent` is one of the few places Pixi hands back `null`,
        // so this boundary uses a truthiness check.
        let cursor = current.parent;
        while (cursor) {
            if (cursor === maybeAncestor) return true;
            cursor = cursor.parent;
        }
        return false;
    }

    const seeds = [1, 7, 42, 1337, 90210];

    it.each(seeds)('agrees with it under a random mutation script (seed %i)', (seed) => {
        const rec = createRecorder();
        const root = container('root');
        root.onRefresh = () => void rec.calls.push('root');
        const random = createRandom(seed);
        const pool: Container[] = [root];
        let counter = 0;

        for (let frame = 0; frame < 60; frame++) {
            const actions = 1 + Math.floor(random() * 4);
            for (let i = 0; i < actions; i++) {
                const roll = random();
                const target = pool[Math.floor(random() * pool.length)];
                if (roll < 0.45) {
                    const child = container(`n${counter++}`);
                    child.onRefresh = () => void rec.calls.push(child.label);
                    target.addChild(child);
                    pool.push(child);
                }
                else if (roll < 0.65 && pool.length > 1) {
                    const victim = pool[1 + Math.floor(random() * (pool.length - 1))];
                    victim.removeFromParent();
                    const index = pool.indexOf(victim);
                    if (index > 0) pool.splice(index, 1);
                }
                else if (roll < 0.8 && pool.length > 2) {
                    const movable = pool[1 + Math.floor(random() * (pool.length - 1))];
                    if (target !== movable && !isAncestorOf(movable, target)) {
                        target.addChild(movable);
                    }
                }
                else if (roll < 0.9 && target.children.length > 1) {
                    target.swapChildren(target.children[0], target.children[1]);
                }
                else if (pool.length > 1) {
                    const victim = pool[1 + Math.floor(random() * (pool.length - 1))];
                    victim.onRefresh = victim.onRefresh === undefined
                        ? () => void rec.calls.push(victim.label)
                        : undefined;
                }
            }

            const expected: string[] = [];
            naiveWalk(root, expected);
            rec.clear();
            refreshScene(root);

            expect([...rec.calls].sort(), `frame ${frame}`).toEqual([...expected].sort());
            expectAncestorsFirst(rec.calls, root);

            // Every second frame, drive a branch as well, to keep two
            // overlapping callers interleaved throughout the script.
            if (frame % 2 !== 0 || pool.length < 2) continue;
            const branch = pool[1 + Math.floor(random() * (pool.length - 1))];
            const branchExpected: string[] = [];
            naiveWalk(branch, branchExpected);
            rec.clear();
            refreshScene(branch);
            expect([...rec.calls].sort(), `frame ${frame} branch`).toEqual([...branchExpected].sort());
        }
    });
});
