import { Container, Graphics } from 'pixi.js';
import type { SwarmEntity } from './swarm-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SwarmViewBindings {
    getEntities(): readonly SwarmEntity[];
    getFieldWidth(): number;
    getFieldHeight(): number;
}

/**
 * An entity view reads its subject through a slot the parent writes.
 *
 * This is the clearest demonstration of why ancestors-before-descendants is the
 * guarantee worth having: the parent fills these slots in its own `onRefresh`,
 * and every child then reads a slot that is already current for this tick.
 */
export interface EntitySlot {
    entity: SwarmEntity | undefined;
    fieldWidth: number;
    fieldHeight: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Reconciles one child view per live entity, adding and removing them from
 * inside `onRefresh`.
 *
 * A pass iterates a snapshot taken before the first refresh method ran, so a
 * child added here is not called until the next pass. That is why
 * `createEntityView` sets its own first frame: a view that spawns children is
 * the one thing that has to think about it, and it is the one thing with
 * everything it needs to hand.
 */
export function createSwarmView(bindings: SwarmViewBindings): Container {
    const view = new Container();
    view.label = 'swarm';

    const records = new Map<number, EntityRecord>();
    const doomed: number[] = [];
    let generation = 0;

    view.onRefresh = refresh;
    return view;

    function refresh(): void {
        const entities = bindings.getEntities();
        const fieldWidth = bindings.getFieldWidth();
        const fieldHeight = bindings.getFieldHeight();
        generation++;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            let record = records.get(entity.id);
            if (record === undefined) {
                const slot: EntitySlot = { entity, fieldWidth, fieldHeight };
                record = { slot, child: createEntityView(slot), seen: generation };
                records.set(entity.id, record);
                view.addChild(record.child);
            }
            record.slot.entity = entity;
            record.slot.fieldWidth = fieldWidth;
            record.slot.fieldHeight = fieldHeight;
            record.seen = generation;
        }

        doomed.length = 0;
        for (const [id, record] of records) {
            if (record.seen !== generation) doomed.push(id);
        }
        for (let i = 0; i < doomed.length; i++) {
            const id = doomed[i];
            const record = records.get(id);
            if (record === undefined) continue;
            records.delete(id);
            record.child.destroy();
        }
    }
}

/**
 * A leaf view with both methods.
 *
 * `onUpdate` advances a pulse that the model knows nothing about - cosmetic
 * presentation state, which is exactly the thing that must keep advancing
 * whether or not anyone is looking at it.
 */
export function createEntityView(slot: EntitySlot): Container {
    const view = new Container();
    view.label = 'entity';

    const dot = new Graphics();
    dot.circle(0, 0, 1).fill(0xffffff);
    view.addChild(dot);

    let pulseMs = 0;

    view.onUpdate = (deltaMs) => {
        pulseMs += deltaMs;
    };

    view.onRefresh = refresh;
    // Born correct rather than at the origin: this view is created from inside
    // its parent's own refresh, so the pass in flight will not reach it.
    refresh();

    return view;

    function refresh(): void {
        const entity = slot.entity;
        if (entity === undefined) return;
        view.position.set(entity.x * slot.fieldWidth, entity.y * slot.fieldHeight);

        const life = entity.ageMs / entity.lifespanMs;
        const fade = life < 0.12 ? life / 0.12 : life > 0.8 ? (1 - life) / 0.2 : 1;
        view.alpha = fade < 0 ? 0 : fade;

        const pulse = 1 + Math.sin(pulseMs * 0.006 + entity.id) * 0.25;
        view.scale.set((2.2 + life * 3.4) * pulse);
        dot.tint = hueToRgb(entity.hue);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface EntityRecord {
    slot: EntitySlot;
    child: Container;
    seen: number;
}

/** Cheap hue ramp. Saturation and value are fixed. */
function hueToRgb(hue: number): number {
    const h = (hue % 1) * 6;
    const x = 1 - Math.abs((h % 2) - 1);
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 1) {
        r = 1;
        g = x;
    }
    else if (h < 2) {
        r = x;
        g = 1;
    }
    else if (h < 3) {
        g = 1;
        b = x;
    }
    else if (h < 4) {
        g = x;
        b = 1;
    }
    else if (h < 5) {
        r = x;
        b = 1;
    }
    else {
        r = 1;
        b = x;
    }
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
