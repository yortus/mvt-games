import type { Audio80 } from '@mvtjs/audio';
import { setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import {
    BURN, CARD_TICK, DEVELOP, KEY_TICK_HIGH, KEY_TICK_LOW, LAUNCH, LOAD_FAILED, NO_RESULTS, PANEL_CLOSE, PANEL_OPEN, PAUSE, POWER_OFF,
    POWER_ON, RESUME, TAG_ADD, TAG_REMOVE,
} from '../data';
import type { ArcadePhase } from '../models';
import type { TransitionPhase, WallEffectKind } from './transition-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the Arcade's audio view plays on, and the state it plays the sounds of. */
export interface ArcadeAudioViewBindings {
    /** The page's own chip, which the view plays on. Read once. */
    readonly sound: Audio80;
    /** Where the Arcade is, from browsing to playing an entry. */
    readonly phase: () => ArcadePhase;
    /** Whether the entry running is paused. */
    readonly isPaused: () => boolean;
    /** Whether an info panel, or the About note, is open. */
    readonly isPanelOpen: () => boolean;
    /** What has been typed in the search. */
    readonly searchText: () => string;
    /** How many tags are chosen in the search. */
    readonly chosenTagCount: () => number;
    /** How many cards the search shows. */
    readonly shownCount: () => number;
    /** Why the last launch failed, if it did. */
    readonly loadFailure: () => string | undefined;
    /** Where the way into or out of an entry is. */
    readonly transitionPhase: () => TransitionPhase;
    /**
     * Whether the tube's beam is concentrated into a line or a dot, as the
     * screen powers on or off. Each burst of static lasts as long as the
     * beam. It is never on for a visitor who has asked for less motion.
     */
    readonly isBeamOn: () => boolean;
    /** What the way into or out of an entry draws over the cards. */
    readonly wallEffect: () => WallEffectKind;
    /** How many times the keyboard has moved the selection to another card. Each rise is one move. */
    readonly cardKeyMoves: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the Arcade's own sounds on the page's chip. It ticks as the keyboard
 * moves between cards and as the search is typed in. It blips as tags are
 * chosen or removed, and as a panel opens or closes. It bonks when a search
 * matches nothing. On the way into an entry it plays a coin, the cards
 * burning and static while the screen powers on. On the way out it plays
 * static while the screen powers off, then the cards developing. It chimes
 * as an entry pauses and resumes, and buzzes when an entry cannot load.
 *
 * The view draws nothing. It is an empty element that is never hidden, so it
 * is always ticked. It polls its bindings once as it is made, so the page's
 * state at that moment plays nothing.
 */
export function ArcadeAudioView(bindings: ArcadeAudioViewBindings): HTMLElement {
    const { sound } = bindings;
    const view = document.createElement('div');
    view.className = 'arcade-audio';
    const watcher = watch({
        phase: bindings.phase,
        isPaused: bindings.isPaused,
        isPanelOpen: bindings.isPanelOpen,
        searchText: bindings.searchText,
        tags: bindings.chosenTagCount,
        shown: bindings.shownCount,
        loadFailure: bindings.loadFailure,
        isBeamOn: bindings.isBeamOn,
        wallEffect: bindings.wallEffect,
        cardMoves: bindings.cardKeyMoves,
    });
    watcher.poll();

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.phase.changed && w.phase.previous === 'browsing') sound.play(LAUNCH);
        // A pause or resume chimes only while the entry keeps playing. Leaving the entry also clears the pause, and that plays nothing.
        if (w.isPaused.changed && !w.phase.changed && w.phase.value === 'playing') sound.play(w.isPaused.value ? PAUSE : RESUME);
        if (w.isPanelOpen.changed) sound.play(w.isPanelOpen.value ? PANEL_OPEN : PANEL_CLOSE);

        // Choosing or removing a tag can change the search's text too. Only the tag's sound plays for that one action.
        if (w.tags.changed) sound.play(w.tags.increased ? TAG_ADD : TAG_REMOVE);
        else if (w.searchText.changed) sound.play(w.searchText.value.length % 2 === 0 ? KEY_TICK_LOW : KEY_TICK_HIGH);
        if (w.shown.changed && w.shown.value === 0) sound.play(NO_RESULTS);

        if (w.loadFailure.changed && w.loadFailure.value !== undefined) sound.play(LOAD_FAILED);
        if (w.wallEffect.changed) {
            if (w.wallEffect.value === 'burn') sound.play(BURN);
            else if (w.wallEffect.value === 'develop') sound.play(DEVELOP);
        }
        // The static starts as the beam comes on. Each burst lasts as long as the beam does.
        if (w.isBeamOn.changed && w.isBeamOn.value) sound.play(bindings.transitionPhase() === 'powering-on' ? POWER_ON : POWER_OFF);
        if (w.cardMoves.changed) sound.play(CARD_TICK);
    }
}
