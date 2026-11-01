/** @jsxImportSource @mvtjs/html */
import type { ArcadeEntry } from '../../entry-types';
import type { ThemeKind } from '../models';
import {
    CARD_BORDER, cardHeightFor, cardLookFor, cardPhotoIn, type CardPhotoKind, cropStyleFor, fullWidthPhotoIn, liftScaleFor,
    type PhotoPose, tapeFor,
} from './card-photo';
import { PixelTextView } from './pixel-text-view';
import type { Rect } from './rect';
import { THEMES } from './themes';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CardViewBindings {
    /** The entry this card always shows. */
    readonly entry: ArcadeEntry;
    /** The entry's address, for the card's link. */
    readonly href: string;
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
    /** The theme the page wears, which says how the card shows its photo, and its name. */
    readonly theme: () => ThemeKind;
    /** Reported with where the card's photo is drawn as it is pressed, for the way into the entry to start from. */
    readonly onLaunchPressed?: (from: PhotoPose) => void;
    readonly onInfoPressed?: () => void;
    /** Whether the entry is one of the visitor's favourites: its star is filled. */
    readonly isFavourite: () => boolean;
    /** Reported as the card's star is pressed. */
    readonly onFavouritePressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One entry on the wall: its name across the top, a photo of it, a star to
 * mark it as a favourite and a button for its info panel. Every card is the
 * same size, and shows its photo as the theme says (`cardPhoto`). In a
 * polaroid, the photo, in the shape the entry chose, is fitted inside a
 * square at the card's centre, tilted a little and taped down across two
 * corners, both its own every time, with the star and the info button along
 * the foot; on the selected card, the polaroid straightens and comes closer,
 * lifting off its tape. Full width, the photo fills a square across the
 * card's foot, edge to edge, with the star and the info button floating over
 * its corner. Only the
 * polaroid (the photo, in its frame) is a link to the entry, so a middle click opens it in a new tab,
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
    let picture: HTMLImageElement | undefined;
    let nameText: HTMLElement | undefined;
    let liveLayer: HTMLElement | undefined;
    const tape: HTMLElement[] = [];

    // What was last written, so each frame writes only what changed
    let drawnX = NaN;
    let drawnY = NaN;
    let drawnWidth = NaN;
    let drawnTheme: ThemeKind | undefined;
    let drawnPhotoKind: CardPhotoKind | undefined;
    // Whether the name in type has been fitted to the card in the theme drawn, or found not shown in it
    let isNameFitted = false;
    let drawnOpacity = NaN;
    let drawnLifted = false;
    let drawnSelected = false;
    let drawnTabStop: boolean | undefined;
    let drawnLive: HTMLElement | undefined;
    let drawnLiveShowing = false;

    return (
        <article
            class="card"
            visible={bindings.isVisible}
            data-entry={entry.id}
            // Its colour from the theme's palette, light enough for its dark title, and from the Arcade's, which every theme has
            style={`--candy: var(--theme-candy-${look.color}); --arcade-candy: var(--arcade-candy-${look.color})`}
            onRefresh={place}
            onContextMenu={(e) => e.preventDefault()}
        >
            <h3 class="card-name" title={entry.name}>
                {PixelTextView({ text: entry.name.toUpperCase(), label: entry.name })}
                {/* The name in the theme's own type, for a theme that sets it so: each theme shows one of the two */}
                <span class="card-name-text" text={entry.name} ref={(e) => { nameText = e; }} />
            </h3>
            <a class="card-link" href={bindings.href} aria-label={entry.name} ref={keepLink} onClick={launch}>
                <div class="card-picture">
                    <div class="card-polaroid" style={`--tilt: ${look.tilt.toFixed(2)}deg`} ref={(e) => { polaroid = e; }}>
                        <div class="card-photo" ref={(e) => { photo = e; }}>
                            <img alt="" ref={loadLazily} />
                            <div class="card-live" ref={keepLiveLayer} />
                        </div>
                    </div>
                    <span class="card-tape" ref={(e) => { tape.push(e); }} />
                    <span class="card-tape" ref={(e) => { tape.push(e); }} />
                </div>
            </a>
            <div class="card-foot">
                <button
                    type="button"
                    class={() => (bindings.isFavourite() ? 'card-favourite is-on' : 'card-favourite')}
                    aria-label={`Favourite: ${entry.name}`}
                    aria-pressed={() => (bindings.isFavourite() ? 'true' : 'false')}
                    title={() => (bindings.isFavourite() ? 'Favourite: shown first' : 'Mark as a favourite, to show it first')}
                    tabIndex={-1}
                    onClick={() => bindings.onFavouritePressed?.()}
                />
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

    /** Moves the card to its place on the wall, fits its photo to its width, and marks it lifted, selected or the Tab stop. */
    function place(card: Element): void {
        const style = (card as HTMLElement).style;
        const x = bindings.x();
        const y = bindings.y();
        if (x !== drawnX || y !== drawnY) {
            drawnX = x;
            drawnY = y;
            style.transform = `translate(${x}px, ${y}px)`;
        }
        const theme = bindings.theme();
        if (theme !== drawnTheme) {
            drawnTheme = theme;
            isNameFitted = false;
        }
        const width = bindings.width();
        const photoKind = THEMES[theme].cardPhoto;
        if (width !== drawnWidth || photoKind !== drawnPhotoKind) {
            drawnWidth = width;
            drawnPhotoKind = photoKind;
            style.width = `${width}px`;
            style.height = `${cardHeightFor(width)}px`;
            card.classList.toggle('has-full-width-photo', photoKind === 'full-width');
            fitToWidth(style, width - 2 * CARD_BORDER, photoKind);
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
        if (!isNameFitted) fitName(card as HTMLElement);
        showLive();
    }

    /**
     * Shrinks the name in type, where the theme shows it, until it fits on
     * one line (`--name-fit`, which the stylesheet's size is multiplied by),
     * as the pixel name fits itself. Every size on the card scales with it,
     * so it fits at any width once it fits at one: it is measured again only
     * for another theme, once the card is on the wall to measure.
     */
    function fitName(card: HTMLElement): void {
        if (nameText === undefined || !bindings.isVisible() || card.offsetParent === null) return;
        isNameFitted = true;
        nameText.style.removeProperty('--name-fit');
        // Its whole width, and the room it has: none at all where the theme shows the pixel name instead
        const natural = nameText.scrollWidth;
        const room = nameText.clientWidth;
        // A little short of the room: text does not shrink in exact proportion, and an overflow of a pixel would cut it off
        if (natural > room && room > 0) nameText.style.setProperty('--name-fit', (room / natural * NAME_FIT_MARGIN).toFixed(4));
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
     * its photo in the square, with the tape across its corners, or the photo
     * in a square across the card's foot, showing the part of the picture
     * that fills it. Its title, in pixels, fits itself. Everything else on the
     * card the stylesheet sizes from `--card-scale`, so a card of any width
     * is the design scaled.
     */
    function fitToWidth(cardStyle: CSSStyleDeclaration, side: number, photoKind: CardPhotoKind): void {
        if (polaroid === undefined || photo === undefined || picture === undefined || liveLayer === undefined) return;
        const isPolaroid = photoKind === 'polaroid';
        const fitted = isPolaroid ? cardPhotoIn(entry, { x: 0, y: 0, width: side, height: side }) : fullWidthPhotoIn(entry, side);
        cardStyle.setProperty('--card-scale', String(fitted.scale));
        polaroid.style.left = `${fitted.polaroid.x}px`;
        polaroid.style.top = `${fitted.polaroid.y}px`;
        polaroid.style.width = `${fitted.polaroid.width}px`;
        polaroid.style.height = `${fitted.polaroid.height}px`;
        polaroid.style.setProperty('--lift', isPolaroid ? liftScaleFor(fitted.polaroid, side).toFixed(4) : '1');
        photo.style.width = `${fitted.photo.width}px`;
        photo.style.height = `${fitted.photo.height}px`;
        // The picture, and the live entry over it, placed so the part of the picture shown fills the photo
        const cropStyle = cropStyleFor(entry, fitted.crop);
        picture.setAttribute('style', cropStyle);
        liveLayer.setAttribute('style', cropStyle);
        // The live entry is drawn at its play size: this scales it to the photo, as the picture is
        photo.style.setProperty('--live-scale', (fitted.photo.width / fitted.crop.width).toFixed(5));
        if (!isPolaroid) return;
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
        picture = img;
        undraggable(img);
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = entry.thumbnail;
    }

    function launch(e: MouseEvent): void {
        // Opening in a new tab or window is the browser's: the entry's address launches it there
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

/** Whether `target` is on one of a card's buttons, its star or its info button, which do not select the card. */
export function isOnCardButton(target: Element): boolean {
    return target.closest('.card-info, .card-favourite') !== null;
}

/** Whether `target` is a card's link, as the keyboard's focus is when it presses Enter on a card. */
export function isCardLink(target: Element): boolean {
    return target.classList.contains('card-link');
}

/**
 * Where the photo on `card` is drawn now, and the whole picture behind it:
 * tilted at rest, or straight and closer while the card is selected, or part
 * way between. Read from the page, when a transition starts.
 */
export function photoPoseOf(card: Element): PhotoPose | undefined {
    const polaroid = card.querySelector<HTMLElement>('.card-polaroid');
    const photo = card.querySelector<HTMLElement>('.card-photo');
    return polaroid === null || photo === null ? undefined : poseOf(polaroid, photo);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much of the room a name too long for its card is shrunk to fill. */
const NAME_FIT_MARGIN = 0.97;

/** The photo's pose, read from the polaroid's transform as it stands, and the picture's place in the photo. */
function poseOf(polaroid: HTMLElement, photo: HTMLElement): PhotoPose {
    const { transform, paddingLeft } = getComputedStyle(polaroid);
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    const scale = Math.hypot(matrix.a, matrix.b);
    // The border as the card fitted it, narrower on a narrow card
    const border = parseFloat(paddingLeft);
    const tilt = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    const bounds = photo.getBoundingClientRect();
    const width = photo.offsetWidth * scale;
    const height = photo.offsetHeight * scale;
    const centreX = (bounds.left + bounds.right) / 2;
    const centreY = (bounds.top + bounds.bottom) / 2;
    const window: Rect = { x: centreX - width / 2, y: centreY - height / 2, width, height };
    return { window, frame: frameBehind(window, photo), tilt, border: border * scale };
}

/**
 * The whole picture behind `window`, where `photo` is drawn: from where the
 * card placed the picture in the photo, in percentages of the photo
 * (`cropStyleFor`).
 */
function frameBehind(window: Rect, photo: HTMLElement): Rect {
    const placed = photo.querySelector('img')?.style;
    if (placed === undefined) return window;
    return {
        x: window.x + parseFloat(placed.left) / 100 * window.width,
        y: window.y + parseFloat(placed.top) / 100 * window.height,
        width: parseFloat(placed.width) / 100 * window.width,
        height: parseFloat(placed.height) / 100 * window.height,
    };
}
