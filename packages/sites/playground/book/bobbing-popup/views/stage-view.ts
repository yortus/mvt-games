import { Container, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { PopupModel, PopupPhase } from '../models';
import { PopupView } from './popup-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StageViewBindings {
    readonly model: PopupModel;
    /** The size of the play area, which takes clicks. Read once. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The popup, the model's phase, and a hint. Click, or press Space, to close
 * the popup while it's open, or open it again once it has closed.
 */
export function StageView({ model, width, height }: StageViewBindings): Container {
    const view = new Container();

    const popup = PopupView({ phase: () => model.phase, progress: () => model.progress });
    popup.x = width / 2;
    const phaseText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 14, fill: 0x8899bb } });
    phaseText.anchor.set(0.5, 0.5);
    phaseText.position.set(width / 2, height - 24);
    view.addChild(popup, phaseText);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointertap', toggle);
    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        phaseText.text = PHASE_TEXTS[model.phase];
    }

    function toggle(): void {
        if (model.phase === 'open') model.close();
        else if (model.phase === 'closed') model.open();
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key !== ' ' || e.repeat) return;
        // Stops Space scrolling the page
        e.preventDefault();
        toggle();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What to say about each phase. Made once, so refresh makes no new strings. */
const PHASE_TEXTS: Readonly<Record<PopupPhase, string>> = {
    opening: "the model's phase: 'opening'",
    open: "the model's phase: 'open' (click to close)",
    closing: "the model's phase: 'closing'",
    closed: "the model's phase: 'closed' (click to open)",
};
