// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewModel {
    /** Whether the announcement is currently visible. */
    readonly isVisible: boolean;
    /** Current alpha (1 during display, fading to 0 during fade-out). */
    readonly alpha: number;
    /** The text to display. Empty string when not visible. */
    readonly text: string;
    /** Advance the announcement timer by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SectionAnnouncementViewModelBindings {
    getSectionIndex(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISPLAY_DURATION_MS = 2000;
const FADE_DURATION_MS = 500;
const TOTAL_MS = DISPLAY_DURATION_MS + FADE_DURATION_MS;

const SECTION_NAMES: readonly string[] = [
    'SECTION 1 - MOUNTAINS',
    'SECTION 2 - CAVES',
    'SECTION 3 - BASE',
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSectionAnnouncementViewModel(bindings: SectionAnnouncementViewModelBindings): SectionAnnouncementViewModel {
    let timerMs = TOTAL_MS;
    let text = '';
    let prevSection = -1;

    const viewModel: SectionAnnouncementViewModel = {
        get isVisible() { return timerMs < TOTAL_MS; },
        get alpha() {
            if (timerMs >= TOTAL_MS) return 0;
            if (timerMs <= DISPLAY_DURATION_MS) return 1;
            return 1 - (timerMs - DISPLAY_DURATION_MS) / FADE_DURATION_MS;
        },
        get text() { return timerMs < TOTAL_MS ? text : ''; },

        update(deltaMs: number): void {
            const sectionIndex = bindings.getSectionIndex();
            if (sectionIndex !== prevSection) {
                text = SECTION_NAMES[sectionIndex] ?? '';
                timerMs = 0;
            }
            prevSection = sectionIndex;
            if (timerMs >= TOTAL_MS) return;
            timerMs += deltaMs;
        },
    };

    return viewModel;
}
