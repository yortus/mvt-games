import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { MAX_STAT, type SwarmModel } from '../models';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The width and height of each enemy's dot, in pixels. */
const DOT_SIZE = 3;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SwarmViewBindings {
    readonly model: SwarmModel;
    /** Whether the refresh adds up each enemy's stats with `Object.values()`, rather than reading them directly. */
    readonly useObjectValues: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A dot for each enemy, made once. Each refresh moves every dot, and makes
 * it brighter the stronger its enemy is: the sum of its stats.
 */
export function SwarmView({ model, useObjectValues }: SwarmViewBindings): Container {
    const view = new Container();
    const { enemies } = model;

    const dots: Sprite[] = [];
    for (let i = 0; i < enemies.length; i++) {
        const dot = new Sprite(Texture.WHITE);
        dot.anchor.set(0.5);
        dot.width = DOT_SIZE;
        dot.height = DOT_SIZE;
        dot.tint = 0xff8844;
        dots.push(dot);
        view.addChild(dot);
    }

    setRefresh(view, useObjectValues ? refreshWithObjectValues : refresh);
    return view;

    function refreshWithObjectValues(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const dot = dots[i];
            dot.position.set(enemy.x, enemy.y);
            // The line from the chapter: a new array for every enemy, every tick
            const values = Object.values(enemy.stats);
            let strength = 0;
            for (let j = 0; j < values.length; j++) strength += values[j];
            dot.alpha = 0.1 + 0.9 * strength / MAX_STRENGTH;
        }
    }

    function refresh(): void {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const dot = dots[i];
            dot.position.set(enemy.x, enemy.y);
            // The same sum, read straight from the properties: nothing new is made
            const stats = enemy.stats;
            const strength = stats.health + stats.armour + stats.attack + stats.speed;
            dot.alpha = 0.1 + 0.9 * strength / MAX_STRENGTH;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The sum of all four stats, at their highest. */
const MAX_STRENGTH = 4 * MAX_STAT;
