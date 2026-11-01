import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { LevelPhase } from '../models';
import { createWipeViewModel } from './wipe-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LevelPaneViewBindings {
    /** The pane's heading, read once. */
    readonly title: string;
    /** Where the pane's top left corner is, read once. */
    readonly x: number;
    readonly y: number;
    readonly level: () => number;
    readonly phase: () => LevelPhase;
    readonly progress: () => number;
    readonly isMotionReduced: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A small screen showing the level, with the cover that wipes across it
 * between levels. A wipe view model works out where the cover is, and how
 * opaque, and this view copies those onto the real cover in `refresh`.
 */
export function LevelPaneView(bindings: LevelPaneViewBindings): Container {
    const view = new Container();
    view.position.set(bindings.x, bindings.y);

    const heading = new Text({ text: bindings.title, style: TITLE_STYLE });
    heading.position.set(0, -30);

    // The level itself: a background in the level's colour, and its name
    const background = new Graphics().rect(0, 0, PANE_W, PANE_H).fill(0xffffff);
    const name = new Text({ text: '', style: NAME_STYLE });
    name.anchor.set(0.5);
    name.position.set(PANE_W / 2, PANE_H / 2);
    const levelName = createComputed({ watch: bindings.level, compute: (level) => 'LEVEL ' + level });

    const cover = new Graphics().rect(0, 0, PANE_W, PANE_H).fill(0x000000);
    // The cover sweeps in from outside the pane, so the pane hides what's outside it
    const mask = new Graphics().rect(0, 0, PANE_W, PANE_H).fill(0xffffff);
    const screen = new Container();
    screen.addChild(background, name, cover, mask);
    screen.mask = mask;
    const frame = new Graphics().rect(0, 0, PANE_W, PANE_H).stroke({ color: 0x5a6a90, width: 2 });
    view.addChild(heading, screen, frame);

    const wipe = createWipeViewModel({
        phase: bindings.phase,
        progress: bindings.progress,
        isMotionReduced: bindings.isMotionReduced,
        screenWidth: PANE_W,
    });

    setUpdate(view, wipe.update);
    setRefresh(view, () => {
        const level = bindings.level();
        background.tint = LEVEL_COLORS[level % LEVEL_COLORS.length];
        name.text = levelName();
        cover.x = wipe.cover.x;
        cover.alpha = wipe.cover.alpha;
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The size of the pane, in pixels. */
const PANE_W = 280;
const PANE_H = 190;

const LEVEL_COLORS: readonly number[] = [0x3d8fe8, 0x4cb860, 0xe8a33d, 0x9b6be0, 0xe05561];

const TITLE_STYLE = { fontFamily: 'monospace', fontSize: 15, fill: 0xe6edf3 };
const NAME_STYLE = { fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold', fill: 0xffffff } as const;
