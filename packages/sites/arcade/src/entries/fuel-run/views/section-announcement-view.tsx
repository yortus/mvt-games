/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createReaction, createSequence } from '@mvtjs/utils';
import { PixelTextView } from '#shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewBindings {
    /** Places the announcement, so read once. */
    screenWidth: number;
    screenHeight: number;
    sectionIndex: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The section's name, shown when the ship enters it and then faded out. It
 * drives its own alpha (0 when idle), since a smooth fade needs alpha, not a
 * visible toggle.
 */
export function SectionAnnouncementView(bindings: SectionAnnouncementViewBindings): Container {
    const sequence = createSequence([
        { name: 'display', startMs: 0, durationMs: DISPLAY_DURATION_MS },
        { name: 'fade', startMs: DISPLAY_DURATION_MS, durationMs: FADE_DURATION_MS },
    ]);
    // Presentation state: the name being announced.
    let text = '';
    const showAnnouncementWhenSectionChanges = createReaction({ watch: bindings.sectionIndex, react: announce });
    // The view is made as the run starts, so the first section is announced now
    announce(bindings.sectionIndex());

    return (
        <container alpha={getAlpha} onUpdate={update}>
            <container x={bindings.screenWidth / 2} y={Math.round(bindings.screenHeight * 0.25)}>
                <PixelTextView text={() => (sequence.isActive ? text : '')} color={LABEL_COLOR} scale={2} anchorX={0.5} anchorY={0.5} />
            </container>
        </container>
    );

    function update(deltaMs: number): void {
        showAnnouncementWhenSectionChanges();
        sequence.update(deltaMs);
    }

    function announce(sectionIndex: number): void {
        text = SECTION_NAMES[sectionIndex] ?? '';
        sequence.start();
    }

    function getAlpha(): number {
        const { fade } = sequence.steps;
        return sequence.isActive ? (fade.isActive ? 1 - fade.progress : 1) : 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DISPLAY_DURATION_MS = 2000;
const FADE_DURATION_MS = 500;

const SECTION_NAMES: readonly string[] = [
    'SECTION 1 - MOUNTAINS',
    'SECTION 2 - CAVES',
    'SECTION 3 - BASE',
];

/** Its color. It is set in the pixel glyphs at twice their size. */
const LABEL_COLOR = 0xffff00;
