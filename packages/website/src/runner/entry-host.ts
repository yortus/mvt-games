import { refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/html';
import type { ElementEntrySession, EntrySession, EntryStarter, PixiEntryStarter } from '../entry-types';
import { createPageSound, type PageSound } from './page-sound';
import { fitPlayArea, type PlayArea } from './play-area';
import type { PixiStage } from './pixi-stage';
import './entry-host.css';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Runs one entry at a time, of either kind, inside an element. It prepares
 * the entry's renderer, starts and stops its sessions, and drives its frames
 * in the MVT order. It holds none of the page's state. The page decides when
 * to start, pause and stop.
 *
 * A Pixi entry draws on a stage that the host owns. The stage's code is in a
 * module of its own, which the host loads the first time it prepares a Pixi
 * entry. So a page that runs no Pixi entry loads no Pixi. An element entry
 * mounts into an element of its own. The host leaves that element out of the
 * page's `updateView` and `refreshView`, and ticks the entry's views itself,
 * through the session's `views`.
 */
export interface EntryHost {
    /** The starter of the entry running, if any. */
    readonly starter: EntryStarter | undefined;
    /** The session running, if any. */
    readonly session: EntrySession | undefined;
    /**
     * While paused, the session's models and its views' update steps are left
     * out. Its views are still refreshed and drawn, so it shows frozen. The
     * sound chip's clock stops too, so the chip fades its sound out and holds
     * every voice where it is.
     */
    isPaused: boolean;
    /**
     * Gets ready to start `starter`. For a Pixi entry, it loads Pixi, makes
     * the Pixi application, and fits the entry to the host's area if the
     * entry fits itself. For an element entry, which brings its own
     * renderers, it lets go of the Pixi application. So the host holds no
     * renderer it does not use.
     *
     * It also loads the page's sound, if the host was given one, and waits
     * for it. So a session never starts before the chip has loaded. Where
     * audio cannot start, the chip stays silent.
     */
    prepare: (starter: EntryStarter) => Promise<void>;
    /** Starts a session of `starter`, which must have been prepared. It ends any session already running. */
    start: (starter: EntryStarter) => void;
    /** Ends the session, and starts a new one of the same entry. */
    restart: () => void;
    /**
     * Ends the session. Returns a copy of its last frame's play area, where
     * the renderer allows one, for the page to show as it leaves.
     */
    stop: () => HTMLCanvasElement | undefined;
    /** Runs one frame. It advances the session's models, then updates and refreshes its views, then draws. */
    tick: (timeMs: number, deltaMs: number) => void;
    /**
     * Returns where an entry's play area would sit in the viewport, in CSS
     * pixels. The area is centred in the host's element and scaled to fit it,
     * as the host would scale it.
     */
    playRectFor: (target: PlayTarget) => Rect;
    /** Removes the host and everything it made. */
    destroy: () => void;
}

/** What `playRectFor` needs to know about an entry. */
export interface PlayTarget {
    /** The entry's play area, as its metadata gives it. */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /** The entry's starter, once it is loaded. Its play area and scaling then take the place of the metadata's. */
    readonly starter?: EntryStarter;
    /** Whether it takes controls, which a touch page draws beside it. */
    readonly hasControls: boolean;
}

/** A rectangle in the viewport, in CSS pixels. */
export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an entry host. */
export interface EntryHostOptions {
    /** The element the entry plays in. The host fills it, and follows its size. */
    readonly element: HTMLElement;
    /** Whether the page is used by touch, so games get on-screen controls. */
    readonly isTouch: boolean;
    /**
     * Whether the entry takes input from the keyboard and touch controls.
     * Defaults to true. It is false for an entry that only plays, such as a
     * preview.
     */
    readonly takesInput?: boolean;
    /**
     * The page's sound. The host plays its sessions on the sound's
     * `entryAudio80`, and prepares the sound along with each entry. The page
     * owns it, sets its settings and destroys it. Without it, the host's
     * sessions play on a silent chip.
     */
    readonly sound?: PageSound;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an entry host, which runs entries inside `options.element`. */
export function createEntryHost(options: EntryHostOptions): EntryHost {
    const { element, isTouch } = options;
    const takesInput = options.takesInput ?? true;

    let starter: EntryStarter | undefined;
    let session: EntrySession | undefined;
    let isPaused = false;
    let pixiStage: PixiStage | undefined;
    const sound = options.sound ?? createPageSound({ isEnabled: false });
    const isSoundOwned = options.sound === undefined;

    // The element an element entry mounts into. The host ticks the entry's
    // views itself, so the page's walk skips this subtree.
    const entryElement = document.createElement('div');
    entryElement.className = 'entry-host-element';
    entryElement.hidden = true;
    setUpdate(entryElement, () => SKIP_DESCENDANTS);
    setRefresh(entryElement, () => SKIP_DESCENDANTS);
    element.append(entryElement);

    // The element's place in the viewport is kept as it changes, so nothing
    // reads layout while the page ticks
    let areaRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(element);
    fit();

    const host: EntryHost = {
        get starter() {
            return starter;
        },
        get session() {
            return session;
        },
        get isPaused() {
            return isPaused;
        },
        set isPaused(value) {
            isPaused = value;
        },

        async prepare(next) {
            await Promise.all([sound.prepare(), prepareRenderer(next)]);
        },

        start(next) {
            host.stop();
            starter = next;
            isPaused = false;
            // No sound of the last session's carries into this one
            sound.entryControls.reset();
            session = startSession(next);
        },

        restart() {
            if (starter === undefined) return;
            host.start(starter);
        },

        stop() {
            if (session === undefined || starter === undefined) return undefined;
            const frame = starter.kind === 'pixi' ? pixiStage?.captureFrame() : undefined;
            session.destroy();
            sound.entryControls.reset();
            if (starter.kind === 'pixi') pixiStage?.hide();
            else entryElement.hidden = true;
            session = undefined;
            starter = undefined;
            return frame;
        },

        tick(timeMs, deltaMs) {
            if (session === undefined || starter === undefined) return;
            if (starter.kind === 'pixi') {
                pixiStage?.tick(timeMs);
                return;
            }
            const elementSession = session as ElementEntrySession;
            const controls = sound.entryControls;
            if (!isPaused) {
                elementSession.update(deltaMs);
                // The chip's clock advances only with the models, so it stops while the game is paused
                controls.update(deltaMs);
            }
            const views = elementSession.views;
            if (!isPaused) {
                for (let i = 0; i < views.length; i++) updateView(views[i], deltaMs);
            }
            for (let i = 0; i < views.length; i++) refreshView(views[i]);
            controls.flush();
            elementSession.render();
        },

        playRectFor(target) {
            const pixiStarter = target.starter?.kind === 'pixi' ? target.starter : undefined;
            const screenWidth = pixiStarter?.screenWidth ?? target.screenWidth;
            const screenHeight = pixiStarter?.screenHeight ?? target.screenHeight;
            const area = fitPlayArea({
                areaWidth: areaRect.width,
                areaHeight: areaRect.height,
                screenWidth,
                screenHeight,
                integerScale: pixiStarter?.integerScale,
                hasTouchControls: isTouch && target.hasControls,
            });
            return toViewportRect(area, screenWidth, screenHeight, areaRect);
        },

        destroy() {
            host.stop();
            resizeObserver.disconnect();
            pixiStage?.destroy();
            pixiStage = undefined;
            if (isSoundOwned) sound.destroy();
            entryElement.remove();
        },
    };

    return host;

    async function prepareRenderer(next: EntryStarter): Promise<void> {
        if (next.kind !== 'pixi') {
            pixiStage?.destroy();
            pixiStage = undefined;
            return;
        }
        fitStarter(next);
        const pixelArt = next.pixelArt ?? false;
        if (pixiStage !== undefined && pixiStage.isPixelArt === pixelArt) return;
        // Antialiasing is fixed when a renderer is made, so a change of style needs a new one
        pixiStage?.destroy();
        pixiStage = undefined;
        const { createPixiStage } = await import('./pixi-stage');
        pixiStage = await createPixiStage({
            element,
            isPixelArt: pixelArt,
            isTouch,
            takesInput,
            session: () => session,
            isPaused: () => isPaused,
            audio80: sound.entryAudio80,
            audioControls: sound.entryControls,
        });
        pixiStage.fit(areaRect.width, areaRect.height);
    }

    function startSession(next: EntryStarter): EntrySession {
        if (next.kind === 'pixi') {
            if (pixiStage === undefined) throw new Error('entry host: prepare a Pixi entry before starting it');
            fitStarter(next);
            return pixiStage.start(next);
        }
        entryElement.hidden = false;
        return next.start({ element: entryElement, sound: sound.entryAudio80 });
    }

    /**
     * Follows the element's size. A Pixi entry is fitted again, and an
     * element entry follows its element itself. The size is the element's
     * own, before any transform, because a preview is drawn at its play size
     * and then scaled down.
     */
    function fit(): void {
        const bounds = element.getBoundingClientRect();
        areaRect = { x: bounds.left, y: bounds.top, width: element.offsetWidth, height: element.offsetHeight };
        if (pixiStage === undefined) return;
        if (starter?.kind === 'pixi' && fitStarter(starter)) session?.resize?.();
        pixiStage.fit(areaRect.width, areaRect.height);
    }

    /** Fits a Pixi entry that lays itself out (`fitTo`) to the host's area, once it has one. Returns whether it did. */
    function fitStarter(next: PixiEntryStarter): boolean {
        if (next.fitTo === undefined || areaRect.width <= 0 || areaRect.height <= 0) return false;
        next.fitTo(areaRect.width, areaRect.height);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Converts a play area, fitted to the host's area at `areaRect`, to a rectangle in the viewport. */
function toViewportRect(area: PlayArea, screenWidth: number, screenHeight: number, areaRect: Rect): Rect {
    return {
        x: areaRect.x + area.offsetX * area.scale,
        y: areaRect.y + area.offsetY * area.scale,
        width: screenWidth * area.scale,
        height: screenHeight * area.scale,
    };
}
