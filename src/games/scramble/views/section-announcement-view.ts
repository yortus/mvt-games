import { Container, Text } from 'pixi.js';
import { type StatefulPixiView } from '#common';
import { createSectionAnnouncementViewModel } from './section-announcement-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewBindings {
    getScreenWidth(): number;
    getScreenHeight(): number;
    getSectionIndex(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSectionAnnouncementView(bindings: SectionAnnouncementViewBindings): StatefulPixiView {
    const vm = createSectionAnnouncementViewModel({
        getSectionIndex: bindings.getSectionIndex,
    });
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
        vm.update(deltaMs);
    }

    function refresh(): void {
        view.visible = vm.isVisible;
        view.alpha = vm.alpha;
        label.text = vm.text;
    }
}
