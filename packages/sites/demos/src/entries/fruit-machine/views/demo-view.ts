import type { Container } from 'pixi.js';
import type { Scene } from 'three';
import type { MusicChip, SfxChip } from '@mvtjs/site-kit/shared';
import type { DemoModel } from '../models';
import type { SymbolArt } from './art';
import { AudioView } from './audio';
import { ControlPanelView } from './panel';
import { PixiMachineView } from './pixi';
import { TerminalView } from './terminal';
import { BanditView } from './three';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    readonly model: DemoModel;
    readonly art: SymbolArt;
    /** The Pixi stage, which the entry draws. The Pixi machine is added to it. */
    readonly stage: Container;
    /** The three.js scene, which the entry draws. The one-armed bandit is added to it. */
    readonly scene: Scene;
    /** What the visitor drags to turn the one-armed bandit. */
    readonly dragSurface: HTMLElement;
    /** The chip the jingles play on. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. */
    readonly sfx: SfxChip<'audio80'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole demo: one machine, four views of it in four quadrants, and a fifth
 * view for its sound. None of them knows the others exist.
 *
 * A view of one renderer can't hold a view of another, so this adds the Pixi
 * machine and the one-armed bandit to the entry's stage and scene, and returns
 * the quadrants in HTML, with the panel, the terminal and the sound in them.
 * The entry puts its two canvases into their quadrants, and ticks all three.
 */
export function DemoView(bindings: DemoViewBindings): HTMLElement {
    const { model, art, stage, scene, dragSurface, music, sfx } = bindings;
    const { machine } = model;
    stage.addChild(PixiMachineView({ model: machine, art }));
    scene.add(BanditView({ model: machine, art, dragSurface }));

    const view = document.createElement('div');
    view.className = 'fruit-machine';
    view.innerHTML = QUADRANTS_HTML;
    findQuadrantBody(view, 'panel').append(ControlPanelView({ model: machine, art }));
    findQuadrantBody(view, 'terminal').append(TerminalView({ model: machine }));

    // Sound has nothing to show, so it takes no place in the grid
    const audio = AudioView({ model: machine, music, sfx });
    audio.hidden = true;
    view.append(audio);

    return view;
}

/** Returns the element that holds the view of quadrant `name`, where the entry puts its canvases. */
export function findQuadrantBody(view: HTMLElement, name: string): HTMLElement {
    const body = view.querySelector<HTMLElement>(`[data-quadrant="${name}"] .quadrant-body`);
    if (body === null) throw new Error(`The fruit machine has no ${name} quadrant`);
    return body;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The four quadrants, each labelled with its renderer, in the order the grid reads them. */
const QUADRANTS_HTML = `
<section class="quadrant" data-quadrant="pixi">
    <span class="quadrant-label"><b>Pixi.js</b> · the modern machine</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="terminal">
    <span class="quadrant-label"><b>HTML</b> · the terminal</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="panel">
    <span class="quadrant-label"><b>HTML</b> · the control panel</span>
    <div class="quadrant-body"></div>
</section>
<section class="quadrant" data-quadrant="three">
    <span class="quadrant-label"><b>Three.js</b> · drag to turn, tap the lever</span>
    <div class="quadrant-body"></div>
</section>`;
