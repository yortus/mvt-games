import { refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/html';
import type { ElementEntrySession, EntrySession, EntryStarter, PixiEntryStarter } from '../entries';
import { fitPlayArea, type PlayArea } from './play-area';
import type { PixiStage } from './pixi-stage';
import './entry-host.css';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Runs one entry at a time, of either kind, inside an element: it prepares
 * the entry's renderer, starts and stops its sessions, and drives its frames
 * in the MVT order. It holds no state of the page's: the page decides when to
 * start, pause and stop.
 *
 * A Pixi entry draws on a stage the host owns, which comes in its own module,
 * loaded the first time one is prepared, so a page that runs no Pixi entry
 * loads no Pixi. An element entry mounts into an element of its own, which
 * the host leaves out of the page's `updateView` and `refreshView` and ticks
 * itself, through the session's `views`.
 */
export interface EntryHost {
    /** The starter of the entry running, if any. */
    readonly starter: EntryStarter | undefined;
    readonly session: EntrySession | undefined;
    /**
     * While paused, the session's models and views' update steps are left out,
     * and its views are still refreshed and drawn: it shows frozen.
     */
    isPaused: boolean;
    /** Gets ready to start `starter`: for a Pixi entry, loads Pixi and makes its application. */
    prepare: (starter: EntryStarter) => Promise<void>;
    /** Starts a session of `starter`, which must have been prepared, ending any session running. */
    start: (starter: EntryStarter) => void;
    /** Ends the session, and starts a new one of the same entry. */
    restart: () => void;
    /**
     * Ends the session. Returns a copy of its last frame's play area, where
     * the renderer allows one, for the page to show as it leaves.
     */
    stop: () => HTMLCanvasElement | undefined;
    /** One frame: the session's models, then its views, then its renderers. */
    tick: (timeMs: number, deltaMs: number) => void;
    /**
     * Where an entry's play area would sit in the viewport, in CSS pixels:
     * centred and scaled to fit the host's element, as the host would scale it.
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
    /** The entry's starter, once it is loaded: its play area and scaling are the ones that count. */
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

export interface EntryHostOptions {
    /** The element the entry plays in. The host fills it, and follows its size. */
    readonly element: HTMLElement;
    /** Whether the page is used by touch, so games get on-screen controls. */
    readonly isTouch: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEntryHost(options: EntryHostOptions): EntryHost {
    const { element, isTouch } = options;

    let starter: EntryStarter | undefined;
    let session: EntrySession | undefined;
    let isPaused = false;
    let pixiStage: PixiStage | undefined;

    // The element an element entry mounts into. The host ticks the entry's
    // views itself, so the page's walk skips this subtree.
    const entryElement = document.createElement('div');
    entryElement.className = 'entry-host-element';
    entryElement.hidden = true;
    setUpdate(entryElement, () => SKIP_DESCENDANTS);
    setRefresh(entryElement, () => SKIP_DESCENDANTS);
    element.append(entryElement);

    // The element's place in the viewport, kept as it changes, so nothing
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
            if (next.kind !== 'pixi') return;
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
                session: () => session,
                isPaused: () => isPaused,
            });
            pixiStage.fit(areaRect.width, areaRect.height);
        },

        start(next) {
            host.stop();
            starter = next;
            isPaused = false;
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
            if (!isPaused) elementSession.update(deltaMs);
            const views = elementSession.views;
            if (!isPaused) {
                for (let i = 0; i < views.length; i++) updateView(views[i], deltaMs);
            }
            for (let i = 0; i < views.length; i++) refreshView(views[i]);
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
            return rectOf(area, screenWidth, screenHeight, areaRect);
        },

        destroy() {
            host.stop();
            resizeObserver.disconnect();
            pixiStage?.destroy();
            pixiStage = undefined;
            entryElement.remove();
        },
    };

    return host;

    function startSession(next: EntryStarter): EntrySession {
        if (next.kind === 'pixi') {
            if (pixiStage === undefined) throw new Error('entry host: prepare a Pixi entry before starting it');
            return pixiStage.start(next as PixiEntryStarter);
        }
        entryElement.hidden = false;
        return next.start({ element: entryElement });
    }

    /** Follows the element's size: a Pixi entry is fitted again, and an element entry follows its element itself. */
    function fit(): void {
        const bounds = element.getBoundingClientRect();
        areaRect = { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
        if (pixiStage === undefined) return;
        pixiStage.fit(areaRect.width, areaRect.height);
        if (starter?.kind === 'pixi' && starter.fitsViewport) session?.resize?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function rectOf(area: PlayArea, screenWidth: number, screenHeight: number, areaRect: Rect): Rect {
    return {
        x: areaRect.x + area.offsetX * area.scale,
        y: areaRect.y + area.offsetY * area.scale,
        width: screenWidth * area.scale,
        height: screenHeight * area.scale,
    };
}
