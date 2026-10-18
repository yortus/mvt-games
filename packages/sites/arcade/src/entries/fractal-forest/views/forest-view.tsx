/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import type { ForestModel, Leaf, LeafKind, Tree } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ForestViewBindings {
    model: ForestModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The screen's size in pixels. */
export const SCREEN_WIDTH = 480;
export const SCREEN_HEIGHT = 360;

/**
 * The sky and ground, coloured for the time of year, and the trees from the
 * back of the forest to the front. Each row further back is smaller, sways
 * less, and stands behind a little more haze. The wind is worked out from
 * the model's time, so it needs no state here.
 */
export function ForestView(bindings: ForestViewBindings): Container {
    const { model } = bindings;
    const skyTop = () => colorThroughYear(SKY_TOPS, model.yearProgress);
    const horizon = () => colorThroughYear(HORIZONS, model.yearProgress);

    // The trees, back to front, with haze over each row before the next row in front of it.
    // A tree's distance never changes, so the rows are laid out once.
    const rows: Container[] = [];
    for (let i = 0; i < model.trees.length; i++) {
        const tree = model.trees[i];
        rows.push(<TreeView tree={tree} time={() => model.time} presence={() => model.presence} />);
        const next = model.trees[i + 1] as Tree | undefined;
        if (tree.distance > 0 && next?.distance !== tree.distance) {
            rows.push(<graphics ref={drawWhole} tint={horizon} alpha={HAZE * tree.distance} />);
        }
    }

    return (
        <container>
            <graphics ref={drawWhole} tint={skyTop} />
            <graphics ref={drawGlow} tint={horizon} />
            <graphics ref={drawGround} tint={() => colorThroughYear(GROUNDS, model.yearProgress)} />
            {rows}
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface TreeViewBindings {
    /** The tree, its fields followed every frame. Its distance never changes, so it is read once. */
    tree: Tree;
    /** Seconds the forest has been growing, for the wind. */
    time: () => number;
    /** How much of the tree is there, from 1 down to 0 as it fades. */
    presence: () => number;
}

/**
 * A tree, standing on its row: its branches, as crisp lines that thin to a
 * pixel at the tips, and its leaves, sharp shapes coloured as they turn. The
 * wind bends it more toward the top. The back row stands still.
 */
function TreeView(bindings: TreeViewBindings): Container {
    const { tree, time } = bindings;
    // Pixels per tree unit, shrinking with distance, where its row stands, and how hard the wind bends it
    const unit = PIXELS_PER_UNIT * (1 - 0.55 * tree.distance);
    const sway = 1 - tree.distance;
    // A square brush: each branch's ends are squared off, past its ends by half its thickness
    const barkStyle = { color: BARK_COLOR, width: 1, cap: 'square' as const };
    // The branches' growth when they were last drawn, so a still tree is not drawn again
    let drawnGrowth = -1;

    return (
        <container x={() => tree.x * PIXELS_PER_UNIT} y={HORIZON + (1 - tree.distance) * ROWS_DEPTH} alpha={bindings.presence}>
            <graphics onRefresh={drawBranches} />
            <List items={tree.leaves}>
                {(leaf) => <LeafView leaf={leaf} kind={() => tree.leafKind} unit={unit} swayAt={swayAt} />}
            </List>
        </container>
    );

    /** Each branch from its base to as far as it has grown, bent with the wind, unless nothing has changed since it was last drawn. */
    function drawBranches(g: Graphics): void {
        let growth = 0;
        for (let i = 0; i < tree.branches.length; i++) growth += tree.branches[i].growth;
        if (sway === 0 && growth === drawnGrowth) return;
        drawnGrowth = growth;
        g.clear();
        for (let i = 0; i < tree.branches.length; i++) {
            const branch = tree.branches[i];
            if (branch.growth === 0) continue;
            const x1 = branch.x0 + (branch.x1 - branch.x0) * branch.growth;
            const y1 = branch.y0 + (branch.y1 - branch.y0) * branch.growth;
            barkStyle.width = Math.max(1, branch.thickness * unit);
            g.moveTo((branch.x0 + swayAt(branch.y0)) * unit, -branch.y0 * unit).lineTo((x1 + swayAt(y1)) * unit, -y1 * unit).stroke(barkStyle);
        }
    }

    /** How far the wind pushes the tree sideways at a height, in its units: more toward the top. */
    function swayAt(y: number): number {
        if (sway === 0) return 0;
        const t = time();
        const wind = 0.16 * Math.sin(t * 0.8) + 0.06 * Math.sin(t * 2.1 + 1);
        // Nothing on or below the ground moves
        const share = Math.max(0, y) / Math.max(1, tree.height);
        return wind * sway * share * share;
    }
}

interface LeafViewBindings {
    leaf: () => Leaf;
    /** The shape of the tree's leaves this year. */
    kind: () => LeafKind;
    /** Pixels per tree unit, for the tree's distance. */
    unit: number;
    /** How far the wind pushes the tree sideways at a height, in its units. */
    swayAt: (y: number) => number;
}

/**
 * A leaf, a sharp shape pointing out from its stalk, coloured as it turns.
 * The wind moves it as it moves the branches at its height, on the tree and
 * as it falls, so it does not jump as it lets go. On the ground it lies still.
 */
function LeafView(bindings: LeafViewBindings): Container {
    const { leaf, kind, unit, swayAt } = bindings;
    // The shape drawn, so it is drawn again only when a new year brings a new one
    let drawnKind: LeafKind | undefined;
    return (
        <graphics
            visible={() => leaf().size > 0 && leaf().remains > 0}
            x={() => (leaf().x + swayAt(leaf().y)) * unit}
            y={() => -leaf().y * unit}
            rotation={() => -leaf().angle}
            scale={() => (leaf().size * unit) / PIXELS_PER_UNIT}
            alpha={() => leaf().remains}
            tint={() => LEAF_SHADES[Math.round(leaf().turn * (LEAF_SHADES.length - 1))]}
            onRefresh={drawShape}
        />
    );

    function drawShape(g: Graphics): void {
        if (kind() === drawnKind) return;
        drawnKind = kind();
        g.clear().poly(LEAF_SHAPES[drawnKind]).fill(0xffffff);
    }
}

/** Pixels per tree unit for a tree at the front, and per forest unit across. */
const PIXELS_PER_UNIT = 30;
/** Where the back row stands, and how far down the screen the front row stands from it, in pixels. */
const HORIZON = 250;
const ROWS_DEPTH = 80;
/** How thick the haze is in front of the back row. Rows nearer get less. */
const HAZE = 0.5;
const BARK_COLOR = 0x1f2433;

/** The sky's colour at the top and at the horizon, and the ground's, at the start of spring, summer, autumn and winter. */
const SKY_TOPS = [0x6fa8c9, 0x3d7fc4, 0x8c5a7a, 0x4a5868];
const HORIZONS = [0xe6f2e0, 0xcfe9f7, 0xf2c38f, 0xd9dfe6];
const GROUNDS = [0x6f9a54, 0x4d7a3a, 0x7a6038, 0xdfe5ea];

/** A leaf's colours as it turns, from summer green to autumn red. */
const LEAF_SHADES = Array.from({ length: 32 }, (_, i) => colorAlong([0x3f9a4a, 0x8fbf3a, 0xf0c63a, 0xe8742a, 0xc0302a], i / 31));

/** Each kind of leaf, pointing right from its stalk at the origin, at full size on a tree at the front. */
const LEAF_SHAPES: Readonly<Record<LeafKind, number[]>> = {
    blade: [0, 0, 5, -1.6, 13, 0, 5, 1.6],
    diamond: [0, 0, 4.5, -3.5, 9, 0, 4.5, 3.5],
    triangle: [0, -3.5, 9, 0, 0, 3.5],
    hexagon: [1, 0, 2.8, -3.2, 6.4, -3.2, 8.2, 0, 6.4, 3.2, 2.8, 3.2],
};

/**
 * How far the sky, ground and haze reach past each edge of the screen, in
 * pixels. The host shows what is drawn round the screen when the window is a
 * different shape, and the trees at the sides reach past it.
 */
const BLEED_X = SCREEN_WIDTH;
const BLEED_Y = SCREEN_HEIGHT;

/** A rectangle over the whole screen and past it, white to be tinted. */
function drawWhole(g: Graphics): void {
    g.rect(-BLEED_X, -BLEED_Y, SCREEN_WIDTH + 2 * BLEED_X, SCREEN_HEIGHT + 2 * BLEED_Y).fill(0xffffff);
}

/** A glow rising from the horizon, strongest at it: white, to be tinted the horizon's colour. */
function drawGlow(g: Graphics): void {
    const bands = 40;
    for (let i = 0; i < bands; i++) {
        g.rect(-BLEED_X, (i * HORIZON) / bands, SCREEN_WIDTH + 2 * BLEED_X, HORIZON / bands).fill({ color: 0xffffff, alpha: (i / (bands - 1)) ** 2 });
    }
}

/** The ground, from the back row's horizon down, and past the screen's sides and bottom, white to be tinted. */
function drawGround(g: Graphics): void {
    g.rect(-BLEED_X, HORIZON - 2, SCREEN_WIDTH + 2 * BLEED_X, SCREEN_HEIGHT - HORIZON + 2 + BLEED_Y).fill(0xffffff);
}

/** The colour `progress` of the way through the year: each season's colour, changing to the next over its last part. */
function colorThroughYear(colors: readonly number[], progress: number): number {
    const at = progress * colors.length;
    const season = Math.floor(at) % colors.length;
    const change = Math.min(1, Math.max(0, (at - Math.floor(at) - 0.6) / 0.4));
    return mixColors(colors[season], colors[(season + 1) % colors.length], change);
}

/** The colour `t` of the way along a row of colours. */
function colorAlong(colors: readonly number[], t: number): number {
    const at = t * (colors.length - 1);
    const i = Math.min(Math.floor(at), colors.length - 2);
    return mixColors(colors[i], colors[i + 1], at - i);
}

/** The colour `t` of the way from `from` to `to`. */
function mixColors(from: number, to: number, t: number): number {
    const r = (from >> 16) + ((to >> 16) - (from >> 16)) * t;
    const g = ((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * t;
    const b = (from & 0xff) + ((to & 0xff) - (from & 0xff)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
