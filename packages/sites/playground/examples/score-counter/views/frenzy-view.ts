import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { FrenzyModel, Target } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FrenzyViewBindings {
    readonly model: FrenzyModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The score, the combo, and the targets, which pulse and fade as they age.
 * Press anywhere to take a shot at the targets.
 */
export function FrenzyView({ model, width, height }: FrenzyViewBindings): Container {
    const view = new Container();

    const scoreText = new Text({
        text: '0',
        style: { fontFamily: 'monospace', fontSize: 32, fill: 0x44ff44, fontWeight: 'bold' },
    });
    scoreText.position.set(10, 8);

    const comboText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffaa00 },
    });
    comboText.position.set(10, 46);

    // One Graphics for each target, added and removed as the targets come and go
    const targetLayer = new Container();
    view.addChild(scoreText, comboText, targetLayer);

    // The whole play area takes the pointer, so a press away from every target is a miss
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerdown', (e) => model.hit(e.globalX, e.globalY));

    // The text is made again only when the number changes, not every frame
    const scoreLabel = createComputed({ watch: () => model.score, compute: String });
    const comboLabel = createComputed({ watch: () => model.combo, compute: (combo) => (combo > 1 ? `${combo}x COMBO` : '') });

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        scoreText.text = scoreLabel();
        comboText.text = comboLabel();

        const targets = model.targets;
        while (targetLayer.children.length > targets.length) {
            targetLayer.removeChildAt(targetLayer.children.length - 1).destroy();
        }
        while (targetLayer.children.length < targets.length) {
            targetLayer.addChild(new Graphics());
        }

        for (let i = 0; i < targets.length; i++) {
            drawTarget(targetLayer.children[i] as Graphics, targets[i]);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Draws a target that pulses as it ages, and fades as its life runs out. */
function drawTarget(g: Graphics, { x, y, radius, ageMs, lifespanMs }: Target): void {
    const life = 1 - ageMs / lifespanMs;
    const r = radius * (1 + 0.08 * Math.sin(ageMs * 0.008));
    g.clear();
    g.circle(x, y, r + 3).fill({ color: 0xff4466, alpha: life * 0.3 });
    g.circle(x, y, r).fill({ color: 0xff4466, alpha: 0.4 + life * 0.6 });
    g.circle(x, y, r * 0.4).fill({ color: 0xffffff, alpha: 0.7 });
}
