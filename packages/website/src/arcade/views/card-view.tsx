/** @jsxImportSource @mvtjs/html */
import { type ArcadeEntry, thumbnailCropOf } from '../../entry-types';
import { tagLabel } from './labels';
import {
    CARD_BORDER, CARD_COLOR_VALUES, cardLookFor, cardPhotoIn, cropStyleFor, liftScaleFor, type PhotoPose, POLAROID_BORDER, tapeFor,
} from './card-photo';
import { PixelTextView } from './pixel-text-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardViewBindings {
    /** The entry this card always shows. */
    readonly entry: ArcadeEntry;
    /** Where the card is drawn on the wall, and how wide, in CSS pixels. */
    readonly x: () => number;
    readonly y: () => number;
    readonly width: () => number;
    readonly opacity: () => number;
    readonly isVisible: () => boolean;
    /** Whether a transition is carrying the card's polaroid: the card's own is hidden meanwhile. */
    readonly isLifted: () => boolean;
    /** Whether the card is selected: its polaroid straightens and comes closer. */
    readonly isSelected: () => boolean;
    /** Whether the card is the wall's one stop for the Tab key. */
    readonly isTabStop: () => boolean;
    /**
     * The element playing the card's entry live (attract mode), drawn at its
     * play size, for the card to show over its photo, scaled and cropped as
     * the photo is; or undefined.
     */
    readonly live: () => HTMLElement | undefined;
    /** Whether the live entry has drawn, so the card can show it in place of its photo. */
    readonly isLiveShowing: () => boolean;
    /** Reported with where the card's photo is drawn as it is pressed, for the way into the entry to start from. */
    readonly onLaunchPressed?: (from: PhotoPose) => void;
    readonly onInfoPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One entry on the wall: its name across the top, a photo of it, and a few of
 * its tags and a button for its info panel along the foot. Every card is the
 * same size: the photo, in the shape the entry chose, sits in a polaroid
 * fitted inside a square at the card's centre, tilted a little and taped
 * down across two corners, both its own every time. On the selected card,
 * the polaroid straightens and comes closer, lifting off its tape. Only the
 * polaroid is a link to the entry, so a middle click opens it in a new tab,
 * and a plain click launches it here; the wall selects the card for a press
 * anywhere else on it. Nothing on the card can be selected or dragged, and it
 * has no context menu, so a long press on a touch screen just holds it. One
 * card's link is a stop for the Tab key; the wall moves the selection, and
 * the info button is reached with `i`. A card selected for a while may play
 * its entry live over its photo (attract mode), out of reach of the pointer
 * and the keys, which still act on the card.
 */
export function CardView(bindings: CardViewBindings): Element {
    const { entry } = bindings;
    const look = cardLookFor(entry);
    let link: HTMLAnchorElement | undefined;
    let polaroid: HTMLElement | undefined;
    let photo: HTMLElement | undefined;
    let liveLayer: HTMLElement | undefined;
    const tape: HTMLElement[] = [];
    const crop = thumbnailCropOf(entry);

    // What was last written, so each frame writes only what changed
    let drawnX = NaN;
    let drawnY = NaN;
    let drawnWidth = NaN;
    let drawnOpacity = NaN;
    let drawnLifted = false;
    let drawnSelected = false;
    let drawnTabStop: boolean | undefined;
    let drawnLive: HTMLElement | undefined;
    let drawnLiveShowing = false;

    const tags = [
        tagLabel({ group: 'kind', value: entry.tags.kind }),
        ...(entry.tags.era === undefined ? [] : [entry.tags.era]),
    ];

    return (
        <article
            class="card"
            visible={bindings.isVisible}
            data-entry={entry.id}
            style={`--candy: ${CARD_COLOR_VALUES[look.color]}`}
            onRefresh={place}
            onContextMenu={(e) => e.preventDefault()}
        >
            <h3 class="card-name" title={entry.name}>{PixelTextView({ text: entry.name.toUpperCase(), label: entry.name })}</h3>
            <a class="card-link" href={`#${entry.id}`} aria-label={entry.name} ref={keepLink} onClick={launch}>
                <div class="card-picture">
                    <div class="card-polaroid" style={`--tilt: ${look.tilt.toFixed(2)}deg`} ref={(e) => { polaroid = e; }}>
                        <div class="card-photo" ref={(e) => { photo = e; }}>
                            <img alt="" style={cropStyleFor(entry)} ref={loadLazily} />
                            <div class="card-live" style={cropStyleFor(entry)} ref={keepLiveLayer} />
                        </div>
                    </div>
                    <span class="card-tape" ref={(e) => { tape.push(e); }} />
                    <span class="card-tape" ref={(e) => { tape.push(e); }} />
                </div>
            </a>
            <div class="card-foot">
                <ul class="card-tags">
                    {tags.map((tag) => <li text={tag} />)}
                </ul>
                <button
                    type="button"
                    class="card-info"
                    aria-label={`About ${entry.name}`}
                    title="About"
                    text="i"
                    tabIndex={-1}
                    onClick={() => bindings.onInfoPressed?.()}
                />
            </div>
        </article>
    );

    /** Moves the card to its place on the wall, fits its polaroid to its width, and marks it lifted, selected or the Tab stop. */
    function place(card: Element): void {
        const style = (card as HTMLElement).style;
        const x = bindings.x();
        const y = bindings.y();
        if (x !== drawnX || y !== drawnY) {
            drawnX = x;
            drawnY = y;
            style.transform = `translate(${x}px, ${y}px)`;
        }
        const width = bindings.width();
        if (width !== drawnWidth) {
            drawnWidth = width;
            style.width = `${width}px`;
            fitToWidth(width - 2 * CARD_BORDER);
        }
        const opacity = bindings.opacity();
        if (opacity !== drawnOpacity) {
            drawnOpacity = opacity;
            style.opacity = String(opacity);
        }
        const isLifted = bindings.isLifted();
        if (isLifted !== drawnLifted) {
            drawnLifted = isLifted;
            card.classList.toggle('is-lifted', isLifted);
        }
        const isSelected = bindings.isSelected();
        if (isSelected !== drawnSelected) {
            drawnSelected = isSelected;
            card.classList.toggle('is-selected', isSelected);
        }
        const isTabStop = bindings.isTabStop();
        if (isTabStop !== drawnTabStop && link !== undefined) {
            drawnTabStop = isTabStop;
            link.tabIndex = isTabStop ? 0 : -1;
        }
        showLive();
    }

    /** Puts the live entry over the photo, or takes it away, and shows it once it has drawn. */
    function showLive(): void {
        if (liveLayer === undefined) return;
        const live = bindings.live();
        if (live !== drawnLive) {
            drawnLive = live;
            if (live === undefined) liveLayer.replaceChildren();
            else liveLayer.replaceChildren(live);
        }
        const isShowing = live !== undefined && bindings.isLiveShowing();
        if (isShowing !== drawnLiveShowing) {
            drawnLiveShowing = isShowing;
            liveLayer.classList.toggle('is-showing', isShowing);
        }
    }

    /**
     * Fits the card to its width, `side` inside its border: the polaroid and
     * its photo in the square, with the tape across its corners. Its title, in
     * pixels, fits itself.
     */
    function fitToWidth(side: number): void {
        if (polaroid === undefined || photo === undefined) return;
        const fitted = cardPhotoIn(entry, { x: 0, y: 0, width: side, height: side });
        polaroid.style.left = `${fitted.polaroid.x}px`;
        polaroid.style.top = `${fitted.polaroid.y}px`;
        polaroid.style.width = `${fitted.polaroid.width}px`;
        polaroid.style.height = `${fitted.polaroid.height}px`;
        polaroid.style.setProperty('--lift', liftScaleFor(fitted.polaroid, side).toFixed(4));
        photo.style.width = `${fitted.photo.width}px`;
        photo.style.height = `${fitted.photo.height}px`;
        // The live entry is drawn at its play size: this scales it to the photo, as the picture is
        photo.style.setProperty('--live-scale', (fitted.photo.width / crop.width).toFixed(5));
        const pieces = tapeFor(fitted.polaroid, look);
        for (let i = 0; i < tape.length; i++) {
            tape[i].style.left = `${pieces[i].x}px`;
            tape[i].style.top = `${pieces[i].y}px`;
            tape[i].style.transform = `translate(-50%, -50%) rotate(${pieces[i].angle.toFixed(2)}deg)`;
        }
    }

    /** The live entry only plays: nothing in it takes the pointer, the focus or keys. */
    function keepLiveLayer(element: HTMLElement): void {
        liveLayer = element;
        element.inert = true;
    }

    function keepLink(element: HTMLAnchorElement): void {
        link = element;
        undraggable(element);
    }

    function undraggable(element: HTMLElement): void {
        element.draggable = false;
    }

    /**
     * Loads the picture only as the card nears the viewport: `loading` must be
     * set before `src`, which starts a load. Like the link, it cannot be dragged.
     */
    function loadLazily(img: HTMLImageElement): void {
        undraggable(img);
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = entry.thumbnail;
    }

    function launch(e: MouseEvent): void {
        // Opening in a new tab or window is the browser's: the link's fragment launches it there
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (photo === undefined || polaroid === undefined) return;
        bindings.onLaunchPressed?.(poseOf(polaroid, photo));
    }
}

// ---------------------------------------------------------------------------
// A card's markup, for the wall
// ---------------------------------------------------------------------------

// What the wall needs to know of a card this view made, asked here, so the
// card's markup stays the card's own.

/** The card this view made for `entryId`, if it is in `container`. */
export function cardIn(container: Element, entryId: string): Element | undefined {
    return container.querySelector(`.card[data-entry="${CSS.escape(entryId)}"]`) ?? undefined;
}

/** The card's link, its polaroid: the wall's stop for the Tab key, and what Enter presses. */
export function linkOf(card: Element): HTMLElement | undefined {
    return card.querySelector<HTMLElement>('.card-link') ?? undefined;
}

/** Whether `target` is on a card's polaroid: pointing at it selects the card, and pressing it launches the entry. */
export function isOnPolaroid(target: Element): boolean {
    return target.closest('.card-polaroid') !== null;
}

/** Whether `target` is on a card's info button, which opens the panel and does not select the card. */
export function isOnInfoButton(target: Element): boolean {
    return target.closest('.card-info') !== null;
}

/** Whether `target` is a card's link, as the keyboard's focus is when it presses Enter on a card. */
export function isCardLink(target: Element): boolean {
    return target.classList.contains('card-link');
}

/**
 * Where the photo on `card` is drawn now: tilted at rest, or straight and
 * closer while the card is selected, or part way between. Read from the
 * page, when a transition starts.
 */
export function photoPoseOf(card: Element): PhotoPose | undefined {
    const polaroid = card.querySelector<HTMLElement>('.card-polaroid');
    const photo = card.querySelector<HTMLElement>('.card-photo');
    return polaroid === null || photo === null ? undefined : poseOf(polaroid, photo);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The photo's pose, read from the polaroid's transform as it stands. */
function poseOf(polaroid: HTMLElement, photo: HTMLElement): PhotoPose {
    const transform = getComputedStyle(polaroid).transform;
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    const scale = Math.hypot(matrix.a, matrix.b);
    const tilt = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    const bounds = photo.getBoundingClientRect();
    const width = photo.offsetWidth * scale;
    const height = photo.offsetHeight * scale;
    const centreX = (bounds.left + bounds.right) / 2;
    const centreY = (bounds.top + bounds.bottom) / 2;
    return { window: { x: centreX - width / 2, y: centreY - height / 2, width, height }, tilt, border: POLAROID_BORDER * scale };
}
