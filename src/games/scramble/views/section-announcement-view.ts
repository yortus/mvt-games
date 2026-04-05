import { Container, Text } from 'pixi.js';
import { createSequence, watch, type StatefulPixiView } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewBindings {
    getScreenWidth(): number;
    getScreenHeight(): number;
    getSectionIndex(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISPLAY_DURATION_MS = 2000;
const FADE_DURATION_MS = 500;

const SECTION_NAMES: readonly string[] = [
    'SECTION 1 - MOUNTAINS',
    'SECTION 2 - CAVES',
    'SECTION 3 - BASE',
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSectionAnnouncementView(bindings: SectionAnnouncementViewBindings): StatefulPixiView {
    const sequence = createSequence([
        { name: 'display', startMs: 0, durationMs: DISPLAY_DURATION_MS },
        { name: 'fade', startMs: DISPLAY_DURATION_MS, durationMs: FADE_DURATION_MS },
    ]);
    const watcher = watch({ sectionIndex: bindings.getSectionIndex });
    let text = '';

    const view = new Container();

    const label = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 20, fill: 0xffff00, align: 'center' },
        anchor: { x: 0.5, y: 0.5 },
        position: { x: bindings.getScreenWidth() / 2, y: bindings.getScreenHeight() * 0.25 },
    });
    view.addChild(label);

    view.visible = false;
    view.onRender = refresh;
    return Object.assign(view, { update });

    function update(deltaMs: number): void {
        const { sectionIndex } = watcher.poll();
        if (sectionIndex.changed) {
            text = SECTION_NAMES[sectionIndex.value] ?? '';
            sequence.start();
        }
        sequence.update(deltaMs);
    }

    function refresh(): void {
        const { fade } = sequence.steps;
        view.visible = sequence.isActive;
        view.alpha = fade.isActive ? 1 - fade.progress : 1;
        label.text = sequence.isActive ? text : '';
    }
}
