import { Container } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSceneScheduler } from './scene-scheduler';
import type { SchedulerStrategyKind } from './mvt-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STRATEGIES: SchedulerStrategyKind[] = ['rebuild', 'incremental'];

interface Recorder {
    readonly updates: string[];
    readonly refreshes: string[];
    readonly deltas: number[];
    clear(): void;
}

function createRecorder(): Recorder {
    const updates: string[] = [];
    const refreshes: string[] = [];
    const deltas: number[] = [];
    return {
        updates,
        refreshes,
        deltas,
        clear() {
            updates.length = 0;
            refreshes.length = 0;
            deltas.length = 0;
        },
    };
}

/** A container that records the order in which its hooks are called. */
function node(label: string, rec: Recorder, hooks: 'both' | 'update' | 'refresh' | 'none' = 'both'): Container {
    const container = new Container();
    container.label = label;
    if (hooks === 'both' || hooks === 'update') {
        container.onUpdate = (deltaMs) => {
            rec.updates.push(label);
            rec.deltas.push(deltaMs);
        };
    }
    if (hooks === 'both' || hooks === 'refresh') {
        container.onRefresh = () => {
            rec.refreshes.push(label);
        };
    }
    return container;
}

/**
 * The contract: every container is called before any of its descendants.
 * Sibling order is explicitly not asserted anywhere in this file.
 */
function expectAncestorsFirst(order: string[], tree: Map<string, string | undefined>): void {
    const position = new Map<string, number>();
    for (let i = 0; i < order.length; i++) {
        expect(position.has(order[i]), `${order[i]} called twice`).toBe(false);
        position.set(order[i], i);
    }
    for (let i = 0; i < order.length; i++) {
        let ancestor = tree.get(order[i]);
        while (ancestor !== undefined) {
            const at = position.get(ancestor);
            if (at !== undefined) {
                expect(at, `${ancestor} must be called before its descendant ${order[i]}`).toBeLessThan(i);
            }
            ancestor = tree.get(ancestor);
        }
    }
}

/** Snapshots parent links by label so ordering can be checked after the fact. */
function parentMap(root: Container): Map<string, string | undefined> {
    const map = new Map<string, string | undefined>();
    walk(root, undefined);
    return map;

    function walk(container: Container, parentLabel: string | undefined): void {
        map.set(container.label, parentLabel);
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            walk(children[i] as Container, container.label);
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each(STRATEGIES)('createSceneScheduler (%s strategy)', (strategy) => {
    let rec: Recorder;

    beforeEach(() => {
        rec = createRecorder();
    });

    function scheduler(root: Container, maxDrainRounds?: number) {
        return createSceneScheduler(root, { strategy, maxDrainRounds });
    }

    describe('traversal order', () => {
        it('calls a container before its descendants', () => {
            const root = node('root', rec);
            const a = node('a', rec);
            const b = node('b', rec);
            const a1 = node('a1', rec);
            const a2 = node('a2', rec);
            a.addChild(a1, a2);
            root.addChild(a, b);

            const scene = scheduler(root);
            scene.update(16);
            scene.refresh();

            const tree = parentMap(root);
            expectAncestorsFirst(rec.updates, tree);
            expectAncestorsFirst(rec.refreshes, tree);
            expect(rec.updates.length).toBe(5);
            expect(rec.refreshes.length).toBe(5);
        });

        it('holds when a subtree is built detached and attached afterwards', () => {
            const root = node('root', rec);
            const scene = scheduler(root);

            const branch = node('branch', rec);
            const leaf = node('leaf', rec);
            branch.addChild(leaf);
            root.addChild(branch);

            scene.refresh();
            expectAncestorsFirst(rec.refreshes, parentMap(root));
        });

        it('holds when a child is attached to an already-attached deep node', () => {
            const root = node('root', rec);
            const mid = node('mid', rec);
            const early = node('early', rec);
            root.addChild(mid);
            mid.addChild(early);

            const scene = scheduler(root);
            // Attached after the scheduler has already listed everything.
            const late = node('late', rec);
            mid.addChild(late);

            scene.refresh();
            expectAncestorsFirst(rec.refreshes, parentMap(root));
            expect(rec.refreshes).toContain('late');
        });

        it('holds when a hook is assigned to a container whose descendants are already listed', () => {
            // This is the case `onRender` gets wrong: the registration list is
            // append-only, so hooking an ancestor after its descendants places
            // the ancestor last.
            const root = node('root', rec);
            const parent = node('parent', rec, 'none');
            const child = node('child', rec);
            parent.addChild(child);
            root.addChild(parent);

            const scene = scheduler(root);
            scene.refresh();
            expect(rec.refreshes).toEqual(['root', 'child']);

            rec.clear();
            parent.onRefresh = () => rec.refreshes.push('parent');
            scene.refresh();

            expectAncestorsFirst(rec.refreshes, parentMap(root));
            expect(rec.refreshes.indexOf('parent')).toBeLessThan(rec.refreshes.indexOf('child'));
        });

        it('holds after a subtree is reparented', () => {
            const root = node('root', rec);
            const left = node('left', rec);
            const right = node('right', rec);
            const movable = node('movable', rec);
            const cargo = node('cargo', rec);
            movable.addChild(cargo);
            left.addChild(movable);
            root.addChild(left, right);

            const scene = scheduler(root);
            scene.refresh();
            rec.clear();

            right.addChild(movable);
            scene.refresh();

            expectAncestorsFirst(rec.refreshes, parentMap(root));
            expect(rec.refreshes.indexOf('right')).toBeLessThan(rec.refreshes.indexOf('movable'));
            expect(rec.refreshes.length).toBe(5);
        });

        it('holds after reparenting via addChildAt, which bypasses removeChild', () => {
            const root = node('root', rec);
            const left = node('left', rec);
            const right = node('right', rec);
            const movable = node('movable', rec);
            left.addChild(movable);
            root.addChild(left, right);

            const scene = scheduler(root);
            scene.refresh();
            rec.clear();

            right.addChildAt(movable, 0);
            scene.refresh();

            expectAncestorsFirst(rec.refreshes, parentMap(root));
            // The bug this guards against is the container being listed twice.
            expect(rec.refreshes.length).toBe(4);
        });

        it('survives sibling reordering, which carries no guarantee', () => {
            const root = node('root', rec);
            const a = node('a', rec);
            const b = node('b', rec);
            const c = node('c', rec);
            root.addChild(a, b, c);

            const scene = scheduler(root);
            scene.refresh();
            rec.clear();

            root.swapChildren(a, c);
            root.addChild(b); // moves b to the end
            root.sortChildren();
            scene.refresh();

            expectAncestorsFirst(rec.refreshes, parentMap(root));
            expect(rec.refreshes.length).toBe(4);
        });
    });

    describe('membership', () => {
        it('stops calling a detached container', () => {
            const root = node('root', rec);
            const child = node('child', rec);
            root.addChild(child);

            const scene = scheduler(root);
            scene.refresh();
            expect(rec.refreshes).toContain('child');

            rec.clear();
            root.removeChild(child);
            scene.refresh();
            expect(rec.refreshes).not.toContain('child');
        });

        it('stops calling a destroyed container', () => {
            const root = node('root', rec);
            const child = node('child', rec);
            root.addChild(child);

            const scene = scheduler(root);
            rec.clear();
            child.destroy();
            scene.refresh();

            expect(rec.refreshes).toEqual(['root']);
        });

        it('drops a whole subtree when its root is removed', () => {
            const root = node('root', rec);
            const branch = node('branch', rec);
            const leaf = node('leaf', rec);
            branch.addChild(leaf);
            root.addChild(branch);

            const scene = scheduler(root);
            rec.clear();
            root.removeChildren();
            scene.refresh();

            expect(rec.refreshes).toEqual(['root']);
        });

        it('stops calling a container whose hook is cleared', () => {
            const root = node('root', rec);
            const child = node('child', rec);
            root.addChild(child);

            const scene = scheduler(root);
            rec.clear();
            child.onRefresh = undefined;
            scene.refresh();

            expect(rec.refreshes).toEqual(['root']);
        });

        it('ignores hooks on containers outside the managed tree', () => {
            const root = node('root', rec);
            const orphan = node('orphan', rec);

            const scene = scheduler(root);
            scene.refresh();

            expect(rec.refreshes).toEqual(['root']);
            expect(orphan.onRefresh).not.toBeUndefined();
        });

        it('skips a container detached partway through a pass', () => {
            const root = new Container();
            root.label = 'root';
            const first = node('first', rec, 'none');
            const doomed = node('doomed', rec);
            root.addChild(first, doomed);
            first.onRefresh = () => {
                rec.refreshes.push('first');
                root.removeChild(doomed);
            };

            const scene = scheduler(root);
            scene.refresh();

            expect(rec.refreshes).toEqual(['first']);
        });
    });

    describe('passes', () => {
        it('passes deltaMs through to onUpdate', () => {
            const root = node('root', rec);
            const scene = scheduler(root);
            scene.update(16.5);
            expect(rec.deltas).toEqual([16.5]);
        });

        it('completes every update before any refresh', () => {
            const order: string[] = [];
            const root = new Container();
            root.label = 'root';
            const a = new Container();
            a.label = 'a';
            const b = new Container();
            b.label = 'b';
            root.addChild(a, b);
            for (const c of [root, a, b]) {
                c.onUpdate = () => order.push(`update:${c.label}`);
                c.onRefresh = () => order.push(`refresh:${c.label}`);
            }

            const scene = scheduler(root);
            scene.update(16);
            scene.refresh();

            const lastUpdate = order.map((e) => e.startsWith('update:')).lastIndexOf(true);
            const firstRefresh = order.map((e) => e.startsWith('refresh:')).indexOf(true);
            expect(lastUpdate).toBeLessThan(firstRefresh);
        });

        it('is idempotent across repeated passes on a static tree', () => {
            const root = node('root', rec);
            const child = node('child', rec);
            root.addChild(child);

            const scene = scheduler(root);
            scene.refresh();
            const first = [...rec.refreshes];
            rec.clear();
            scene.refresh();

            expect(rec.refreshes).toEqual(first);
        });

        it('does nothing once destroyed', () => {
            const root = node('root', rec);
            const scene = scheduler(root);
            scene.destroy();
            scene.destroy();
            scene.refresh();
            scene.update(16);

            expect(rec.refreshes).toEqual([]);
            expect(rec.updates).toEqual([]);
        });
    });

    describe('drain-the-tail', () => {
        it('refreshes children spawned during a parent refresh on the same tick', () => {
            const root = new Container();
            root.label = 'root';
            let spawned = false;
            root.onRefresh = () => {
                rec.refreshes.push('root');
                if (spawned) return;
                spawned = true;
                root.addChild(node('spawned', rec));
            };

            const scheduler0 = scheduler(root);
            scheduler0.refresh();

            expect(rec.refreshes).toEqual(['root', 'spawned']);
        });

        it('drains grandchildren spawned by a drained child', () => {
            const root = new Container();
            root.label = 'root';
            let done = false;
            root.onRefresh = () => {
                rec.refreshes.push('root');
                if (done) return;
                done = true;
                const child = new Container();
                child.label = 'child';
                child.onRefresh = () => {
                    rec.refreshes.push('child');
                    child.addChild(node('grandchild', rec));
                };
                root.addChild(child);
            };

            const scene = scheduler(root, 4);
            scene.refresh();

            expect(rec.refreshes).toEqual(['root', 'child', 'grandchild']);
        });

        it('gives up after maxDrainRounds when a hook spawns forever', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const root = new Container();
            root.label = 'root';
            let n = 0;
            const spawnForever = (container: Container): void => {
                const child = new Container();
                child.label = `n${n++}`;
                child.onRefresh = () => {
                    rec.refreshes.push(child.label);
                    spawnForever(child);
                };
                container.addChild(child);
            };
            root.onRefresh = () => {
                rec.refreshes.push('root');
                spawnForever(root);
            };

            const scene = scheduler(root, 3);
            scene.refresh();

            // root, then exactly three drain rounds, then a bail-out.
            expect(rec.refreshes.length).toBe(4);
            expect(scene.stats.drainRounds).toBe(3);
            warn.mockRestore();
        });

        it('also drains the update pass', () => {
            const root = new Container();
            root.label = 'root';
            let spawned = false;
            root.onUpdate = (deltaMs) => {
                rec.updates.push('root');
                rec.deltas.push(deltaMs);
                if (spawned) return;
                spawned = true;
                root.addChild(node('spawned', rec, 'update'));
            };

            const scene = scheduler(root);
            scene.update(16);

            expect(rec.updates).toEqual(['root', 'spawned']);
            expect(rec.deltas).toEqual([16, 16]);
        });
    });
});

// ---------------------------------------------------------------------------
// Differential test
// ---------------------------------------------------------------------------

describe('strategy equivalence', () => {
    /** Deterministic PRNG so a failure is reproducible. */
    function createRandom(seed: number): () => number {
        let state = seed >>> 0;
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 0x100000000;
        };
    }

    /**
     * Applies the same pseudo-random mutation script to a scene driven by each
     * strategy, and asserts they agree on which containers were called. Order
     * is checked against the contract rather than between strategies, because
     * sibling order is allowed to differ.
     */
    function runScript(strategy: SchedulerStrategyKind, seed: number): { called: string[]; tree: Map<string, string | undefined> } {
        const rec = createRecorder();
        const root = node('root', rec);
        const scene = createSceneScheduler(root, { strategy });
        const random = createRandom(seed);
        const pool: Container[] = [root];
        let counter = 0;

        for (let tick = 0; tick < 60; tick++) {
            const actions = 1 + Math.floor(random() * 4);
            for (let i = 0; i < actions; i++) {
                const roll = random();
                const target = pool[Math.floor(random() * pool.length)];
                if (roll < 0.45) {
                    const child = node(`n${counter++}`, rec);
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
                    target.swapChildren(target.children[0] as Container, target.children[1] as Container);
                }
                else if (pool.length > 1) {
                    const victim = pool[1 + Math.floor(random() * (pool.length - 1))];
                    victim.onRefresh = victim.onRefresh === undefined
                        ? () => rec.refreshes.push(victim.label)
                        : undefined;
                }
            }
            rec.clear();
            scene.refresh();
        }

        return { called: [...rec.refreshes], tree: parentMap(root) };
    }

    function isAncestorOf(maybeAncestor: Container, container: Container): boolean {
        // `Container.parent` is one of the few places Pixi hands back `null`,
        // so this boundary uses a truthiness check rather than comparing.
        let cursor = container.parent;
        while (cursor) {
            if (cursor === maybeAncestor) return true;
            cursor = cursor.parent;
        }
        return false;
    }

    const seeds = [1, 7, 42, 1337, 90210];

    it.each(seeds)('both strategies call the same containers (seed %i)', (seed) => {
        const rebuilt = runScript('rebuild', seed);
        const incremental = runScript('incremental', seed);

        expect([...incremental.called].sort()).toEqual([...rebuilt.called].sort());
        expect(incremental.called.length).toBeGreaterThan(0);
    });

    it.each(seeds)('both strategies satisfy ancestors-before-descendants (seed %i)', (seed) => {
        for (const strategy of STRATEGIES) {
            const run = runScript(strategy, seed);
            expectAncestorsFirst(run.called, run.tree);
        }
    });
});
