import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { GlassWindow } from '../models';
import { LOCK_LEAD_WIDTH, mixColours, SHADOW_ALPHA, SHADOW_OFFSET, shiftPolygon } from './board-drawing';
import type { BoardShapes } from './board-shapes';
import type { BoardViewModel, LiftingGroup } from './board-view-model';
import { LEAD_COLOR, SETTLE_MS, SOLVED_LEAD_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LiftingGroupsViewBindings {
    /** The window's shapes, its puzzle, and the board's presentation state, read once. */
    shapes: BoardShapes;
    puzzle: GlassWindow;
    viewModel: BoardViewModel;
    /** Whether the board's presentation state is for this puzzle yet. Until it is, no group lifts. */
    isStateCurrent: () => boolean;
    pieceAt: (tile: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The locked groups lifting, shaking and settling as pieces join them, each
 * as one piece: its lead and glass, drawn about its middle as it lifts, and
 * moved, turned and scaled as one every frame. As a large group's edge
 * swings further for the same turn, a group turns and grows only as far as
 * keeps its edge within a few pixels.
 */
export function LiftingGroupsView(bindings: LiftingGroupsViewBindings): Container {
    const { shapes, puzzle, viewModel } = bindings;
    const view = new Container();
    let drawnGroupsChanged = -1;
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const { centreX, centreY, scale } = shapes;
        const isStateCurrent = bindings.isStateCurrent();
        const { groups, groupsChanged, sunShare } = viewModel;
        if (groupsChanged !== drawnGroupsChanged) {
            drawnGroupsChanged = groupsChanged;
            for (const child of view.removeChildren()) child.destroy({ children: true });
            if (isStateCurrent) for (let i = 0; i < groups.length; i++) view.addChild(makeGroupView(groups[i]));
        }
        if (!isStateCurrent || view.children.length !== groups.length) return;
        const leadTint = mixColours(LEAD_COLOR, SOLVED_LEAD_COLOR, sunShare);
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const groupView = view.children[i];
            const p = Math.min(1, group.ms / SETTLE_MS);
            const bump = Math.sin(Math.PI * p);
            const reach = group.reach * scale;
            const growth = Math.min(SETTLE_GROWTH, SETTLE_EDGE_GROWTH / reach);
            const shake = Math.min(SETTLE_SHAKE, SETTLE_EDGE_SHAKE / reach);
            groupView.position.set(centreX + group.x * scale, centreY + group.y * scale - SETTLE_RAISE * bump);
            groupView.rotation = shake * Math.sin(2 * Math.PI * SETTLE_SHAKES * p) * (1 - p);
            groupView.scale.set(1 + growth * bump);
            const shadow = groupView.children[0];
            shadow.alpha = bump;
            shadow.position.set(SHADOW_OFFSET * bump, SHADOW_OFFSET * 1.5 * bump);
            groupView.children[1].tint = leadTint;
            groupView.children[3].tint = leadTint;
            groupView.children[3].alpha = 1 - sunShare;
        }
    }

    /** A group's composite, about its middle: its shadow, its lead (white, to be tinted), its glass, and the heavier lead round it. */
    function makeGroupView(group: LiftingGroup): Container {
        const { colours, patch } = puzzle;
        const { centreX, centreY, scale, outers, insets, sideNeighbours } = shapes;
        const mx = centreX + group.x * scale;
        const my = centreY + group.y * scale;
        const shadow = new Graphics();
        const groupLead = new Graphics();
        const groupGlass = new Graphics();
        const groupLocks = new Graphics();
        const isInGroup = new Uint8Array(outers.length);
        for (let i = 0; i < group.tiles.length; i++) isInGroup[group.tiles[i]] = 1;
        for (let i = 0; i < group.tiles.length; i++) {
            const t = group.tiles[i];
            const outer = shiftPolygon(outers[t], mx, my);
            const inset = shiftPolygon(insets[t], mx, my);
            shadow.poly(outer).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
            groupLead.poly(outer).fill(0xffffff);
            groupGlass.poly(inset).fill(colours[bindings.pieceAt(t)]);
            const start = patch.cornerStarts[t];
            const sides = patch.cornerStarts[t + 1] - start;
            for (let k = 0; k < sides; k++) {
                const across = sideNeighbours[start + k];
                if (across >= 0 && isInGroup[across] === 1) continue;
                const next = (k + 1) % sides;
                groupLocks.moveTo(inset[k * 2], inset[k * 2 + 1]).lineTo(inset[next * 2], inset[next * 2 + 1]);
                groupLocks.stroke({ color: 0xffffff, width: LOCK_LEAD_WIDTH, cap: 'round' });
            }
        }
        const groupView = new Container();
        groupView.addChild(shadow, groupLead, groupGlass, groupLocks);
        return groupView;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * As a group lifts, shakes and settles, over SETTLE_MS: how much larger it
 * grows and how high it lifts, in pixels, at the top, and how far it turns
 * either way, in radians, and how many times, dying away. A large group
 * grows and turns less, so its edge moves no more than a few pixels.
 */
const SETTLE_GROWTH = 0.14;
const SETTLE_RAISE = 5;
const SETTLE_SHAKE = 0.12;
const SETTLE_SHAKES = 3;
const SETTLE_EDGE_GROWTH = 6;
const SETTLE_EDGE_SHAKE = 5;
