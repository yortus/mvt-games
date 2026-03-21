import { Container, Text } from 'pixi.js';
import { watch } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewBindings {
    getSectionIndex(): number;
    getScreenWidth(): number;
    getScreenHeight(): number;
}

// ---------------------------------------------------------------------------
// Section names
// ---------------------------------------------------------------------------

const SECTION_NAMES: readonly string[] = [
    'SECTION 1 - MOUNTAINS',
    'SECTION 2 - CAVES',
    'SECTION 3 - BASE',
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSectionAnnouncementView(bindings: SectionAnnouncementViewBindings): Container {
    const DISPLAY_DURATION_MS = 2000;
    const FADE_DURATION_MS = 500;
    const TOTAL_MS = DISPLAY_DURATION_MS + FADE_DURATION_MS;

    const watcher = watch({ section: bindings.getSectionIndex });

    let timerMs = TOTAL_MS; // start as expired so nothing shows initially

    const label = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 20, fill: 0xffff00, align: 'center' },
    });
    label.anchor.set(0.5);
    label.position.set(bindings.getScreenWidth() / 2, bindings.getScreenHeight() * 0.25);

    const view = new Container();
    view.addChild(label);
    view.visible = false;
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.section.changed) {
            const idx = watched.section.value as number;
            label.text = SECTION_NAMES[idx] ?? '';
            timerMs = 0;
            view.visible = true;
            view.alpha = 1;
        }

        if (timerMs >= TOTAL_MS) return;

        // Advance timer by ~16ms (approximate frame time for presentation-only state)
        timerMs += 16;

        if (timerMs >= TOTAL_MS) {
            view.visible = false;
        }
        else if (timerMs > DISPLAY_DURATION_MS) {
            // Fade out
            view.alpha = 1 - (timerMs - DISPLAY_DURATION_MS) / FADE_DURATION_MS;
        }
    }
}
