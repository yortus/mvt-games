/** @jsxImportSource @mvtjs/html */
import type { ArcadeEntry } from '../../entry-types';
import { createAttractViewModel } from './attract-view-model';
import type { PhotoPose } from './card-photo';
import { cardIn, CardView, isCardLink, isOnInfoButton, isOnPolaroid, linkOf, photoPoseOf } from './card-view';
import { movedPosition, wallMoveFor } from './card-wall-keys';
import type { CardWallLayout } from './card-wall-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardWallViewBindings {
    /** Every entry, shown or not, in a fixed order: card `i` always shows entry `i`. */
    readonly entries: readonly ArcadeEntry[];
    /** Where each card goes, shared with the arcade view, which reads where the cards are as a transition starts. */
    readonly layout: CardWallLayout;
    /** How many cards are shown, and which, in order: the order the keyboard moves through. */
    readonly shownCount: () => number;
    readonly shownIndexAt: (position: number) => number;
    /** The card whose polaroid a transition is carrying, or -1. */
    readonly liftedIndex: () => number;
    /**
     * Whether the wall is what the visitor is looking at: not under an entry,
     * an info panel or a transition. Only then does it answer keys, or hold
     * the focus.
     */
    readonly isActive: () => boolean;
    /** Whether the visitor has asked for less motion: a card moved to is then scrolled to at once. */
    readonly isMotionReduced: () => boolean;
    /**
     * Whether a card selected for a while may play its entry live (attract
     * mode) now: not on a touch screen, nor for less motion, and only while
     * the wall is active.
     */
    readonly canPlayLive: () => boolean;
    /** The card whose entry the page is playing live, or -1, and the element it plays in. */
    readonly liveIndex: () => number;
    readonly liveElement: HTMLElement | undefined;
    /** Whether the live entry has drawn, so its card can show it. */
    readonly isLiveShowing: () => boolean;
    /** Reported with the card whose entry should play live, or -1 for none, as it changes. */
    readonly onLiveWanted?: (index: number) => void;
    /** Reported with the card pressed, and where its photo is drawn, for the way into its entry to start from. */
    readonly onLaunchPressed?: (index: number, from: PhotoPose) => void;
    readonly onInfoPressed?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The wall of cards, one per entry. Its layout view model places the cards
 * and moves them; this view measures the wall's width and each card's height
 * for it as they change, and writes where each card goes.
 *
 * One card at a time is selected: its polaroid straightens and comes closer.
 * Pointing at a card's polaroid, or holding it, selects the card; so does a
 * click anywhere else on the card, which, unlike a click on the polaroid,
 * does not launch its entry. A card stays selected until another is, or
 * until such a click on it again deselects it.
 *
 * For the keyboard, the wall is one stop for the Tab key: the selected card,
 * or the first shown if none is. The arrows, or W, A, S and D, move the
 * selection; Enter or Space plays the selected card's entry, and `i` opens
 * its info panel. The selection is this view's presentation state. When an
 * entry, an info panel or a transition takes over, the wall lets go of the
 * focus, and takes it back after.
 *
 * A card that stays selected for a second plays its entry live over its
 * photo, where that is allowed (attract mode). The wall says which card,
 * through an attract view model; the page plays the entry, and the card
 * shows it.
 */
export function CardWallView(bindings: CardWallViewBindings): Element {
    const { entries, layout } = bindings;

    const cards = entries.map((entry, index) => CardView({
        entry,
        x: () => layout.xAt(index),
        y: () => layout.yAt(index),
        width: () => layout.columnWidth,
        opacity: () => layout.opacityAt(index),
        isVisible: () => layout.isVisibleAt(index),
        isLifted: () => bindings.liftedIndex() === index,
        isSelected: () => selected === index && tabStop === index,
        isTabStop: () => tabStop === index,
        live: () => (bindings.liveIndex() === index ? bindings.liveElement : undefined),
        isLiveShowing: bindings.isLiveShowing,
        onLaunchPressed: (from) => bindings.onLaunchPressed?.(index, from),
        onInfoPressed: () => bindings.onInfoPressed?.(index),
    }));
    const indexOfCard = new Map<Element, number>(cards.map((card, index) => [card, index]));
    const links = cards.map(linkOf);

    // Presentation state: the card selected last, if any, and the focus to
    // give it, if any, as the wall next refreshes
    let selected = -1;
    let focusPending: 'none' | 'in-place' | 'into-view' = 'none';
    let wasActive = true;
    /** Whether a card had the focus when the wall was last active, to give it back on return. */
    let hadFocus = false;
    /** Worked out once a frame, before the cards read it: the selected card if shown, or else the first shown. */
    let tabStop = -1;

    // Attract mode: the selected card, once it has stayed selected a while,
    // plays its entry live. The page plays it; the wall says which.
    const attract = createAttractViewModel({
        candidate: () => (bindings.canPlayLive() && selected >= 0 && selected === tabStop ? selected : -1),
        delayMs: ATTRACT_DELAY_MS,
    });
    let wantedLive = -1;

    // Sizes are measured as layout settles, and reported to the layout as input
    const observer = new ResizeObserver((records) => {
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const index = indexOfCard.get(record.target);
            if (index === undefined) layout.setWidth(record.contentRect.width);
            else layout.setCardHeightAt(index, record.borderBoxSize[0]?.blockSize ?? record.contentRect.height);
        }
    });

    let drawnHeight = NaN;

    return (
        <section
            class="card-wall"
            aria-label="Entries"
            ref={attach}
            onUpdate={update}
            onRefresh={refresh}
            onKeyDown={onKeyDown}
            onClick={onClick}
            onDestroyed={() => observer.disconnect()}
        >
            {cards}
        </section>
    );

    /** Moves the cards, and says which card's entry should play live as that changes. */
    function update(deltaMs: number): void {
        layout.update(deltaMs);
        attract.update(deltaMs);
        if (attract.index === wantedLive) return;
        wantedLive = attract.index;
        bindings.onLiveWanted?.(wantedLive);
    }

    /** Sizes the wall, settles the Tab stop, and hands the focus over as the wall is left and returned to. */
    function refresh(wall: Element): void {
        drawHeight(wall as HTMLElement);
        tabStop = selectedShown();
        const isActive = bindings.isActive();
        followActivity(wall, isActive);
        giveFocus(isActive);
    }

    function drawHeight(wall: HTMLElement): void {
        if (layout.height === drawnHeight) return;
        drawnHeight = layout.height;
        wall.style.height = `${drawnHeight}px`;
    }

    /**
     * As the wall is left, lets go of the focus, which would take keys meant
     * for the entry or the panel; as it is returned to, asks for it back.
     */
    function followActivity(wall: Element, isActive: boolean): void {
        if (isActive === wasActive) return;
        wasActive = isActive;
        if (!isActive) {
            const focused = document.activeElement;
            hadFocus = focused instanceof HTMLElement && wall.contains(focused);
            if (focused instanceof HTMLElement && hadFocus) focused.blur();
        }
        else if (hadFocus) {
            hadFocus = false;
            // The page kept its place, and the polaroid came back to the card where it is
            focusPending = 'in-place';
        }
    }

    function giveFocus(isActive: boolean): void {
        if (focusPending === 'none' || !isActive || tabStop < 0) return;
        links[tabStop]?.focus({ preventScroll: true });
        if (focusPending === 'into-view') {
            cards[tabStop].scrollIntoView({ block: 'nearest', behavior: bindings.isMotionReduced() ? 'auto' : 'smooth' });
        }
        focusPending = 'none';
    }

    /** The selected card, if it is shown; otherwise the first card shown, or -1 if none is. */
    function selectedShown(): number {
        const count = bindings.shownCount();
        for (let p = 0; p < count; p++) {
            if (bindings.shownIndexAt(p) === selected) return selected;
        }
        return count > 0 ? bindings.shownIndexAt(0) : -1;
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.isActive() || e.ctrlKey || e.metaKey || e.altKey || tabStop < 0) return;
        const move = wallMoveFor(e.key);
        if (move !== undefined) {
            const position = positionOf(tabStop);
            const next = movedPosition({ position, move, shownCount: bindings.shownCount(), columnCount: layout.columnCount });
            selected = bindings.shownIndexAt(next);
            focusPending = 'into-view';
        }
        else if (e.key === 'i' || e.key === 'I') {
            selected = tabStop;
            bindings.onInfoPressed?.(tabStop);
        }
        else if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && isCardLink(e.target)) {
            // The selected card's, which pointing may have moved away from the focused one
            links[tabStop]?.click();
        }
        else {
            return;
        }
        e.preventDefault();
    }

    /**
     * A click on a card, but not on its polaroid (the link) or its info
     * button, selects the card, and gives it the focus, for the keyboard to
     * go on from; or, if it is selected, deselects it.
     */
    function onClick(e: MouseEvent): void {
        if (!bindings.isActive() || !(e.target instanceof Element)) return;
        if (isOnPolaroid(e.target) || isOnInfoButton(e.target)) return;
        const index = cardIndexOf(e.target);
        if (index < 0) return;
        if (index === selected && tabStop === index) {
            selected = -1;
            return;
        }
        selected = index;
        focusPending = 'in-place';
    }

    /**
     * Pointing at a polaroid, or holding it, selects its card. The focus
     * stays where it is: pointing must not take it from the search box, and
     * the wall's keys act on the selected card, wherever on the wall the
     * focus is.
     */
    function onPointerOver(e: PointerEvent): void {
        if (!bindings.isActive() || !(e.target instanceof Element) || !isOnPolaroid(e.target)) return;
        const index = cardIndexOf(e.target);
        if (index >= 0) selected = index;
    }

    /** A card focused by any means, a click or Tab, becomes the selected one. */
    function onFocusIn(e: FocusEvent): void {
        const index = e.target instanceof Node ? cardIndexOf(e.target) : -1;
        if (index >= 0) selected = index;
    }

    function cardIndexOf(target: Node): number {
        for (let i = 0; i < cards.length; i++) {
            if (cards[i].contains(target)) return i;
        }
        return -1;
    }

    function positionOf(index: number): number {
        const count = bindings.shownCount();
        for (let p = 0; p < count; p++) {
            if (bindings.shownIndexAt(p) === index) return p;
        }
        return 0;
    }

    /** Measures the wall and its cards, and listens for what the JSX runtime has no attribute for. */
    function attach(wall: HTMLElement): void {
        observer.observe(wall);
        for (let i = 0; i < cards.length; i++) observer.observe(cards[i], { box: 'border-box' });
        wall.addEventListener('focusin', onFocusIn);
        wall.addEventListener('pointerover', onPointerOver);
    }
}

/**
 * Where the photo on the card for `entryId`, on `wall` (a wall this view
 * made), is drawn now, if the card is there. Read from the page, when a
 * transition starts.
 */
export function photoPoseIn(wall: Element, entryId: string): PhotoPose | undefined {
    const card = cardIn(wall, entryId);
    return card === undefined ? undefined : photoPoseOf(card);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a card stays selected before it plays its entry live. */
const ATTRACT_DELAY_MS = 1000;
