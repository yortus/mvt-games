import { Container, TextureSource } from 'pixi.js';
import { createHeadlessAudio80, createHeadlessAudio90 } from 'audio90/headless';
import {
    type ArcadeEntry, type ElementEntrySession, type ElementEntryStarter, type EntryLauncher, type EntrySession, type EntryStarter, type PlayRect, type SessionChips,
    type SoundChipFinder, type SoundChipKind, startElementEntry, startPixiEntry,
} from '../entry-types';
import { type ArcadeControls, createArcadeControls } from '../input';
import { type AttractPilot, createAttractPilot } from './attract-pilot';
import './showcase.css';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** An entry running live on a screen in a showcase, as the screen shows it. */
export interface LiveEntry {
    /** The container the entry draws on, in its own pixels, the size of its play area. */
    readonly stage: Container;
    readonly width: number;
    readonly height: number;
    /** Whether the entry is pixel art, which the screen shows with hard edges. */
    readonly isPixelArt: boolean;
    /**
     * For an entry that draws with the DOM: the box it's built in, on the
     * showcase's overlay, the size of its play area in its own pixels. Its
     * stage is then empty, and `LiveElementView` lays this box over the
     * screen. It starts hidden, and doesn't receive pointer events.
     */
    readonly element?: HTMLElement;
    /**
     * For an entry that draws with the DOM: its session, whose views
     * `LiveElementView` ticks and renders, as `ScreenView` ticks a Pixi
     * entry's stage.
     */
    readonly elementSession?: ElementEntrySession;
}

/**
 * Runs a site's entries on the screens of a showcase. The few screens
 * nearest the visitor run their entries silently in attract mode, and an
 * attract pilot plays a game that uses the arcade controls. An entry that
 * brings its own renderer runs in a box on the overlay, if there is one, or
 * its screen shows its picture. Once the visitor steps up to a screen, the
 * host launches its entry through the page's launcher, and calls
 * `onPlayEnded` once they leave it, or at once without a launcher.
 */
export interface LiveEntriesHost {
    /** The entry running on the screen at `index`, once its code has loaded and its session has started. */
    readonly liveAt: (index: number) => LiveEntry | undefined;
    /** Where the page will play the entry on the screen at `index`, in the showcase's own pixels, if the showcase runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /**
     * Launches the entry stepped up to, or calls `onPlayEnded` once the
     * visitor has left it. Then it starts and ends attract sessions as the
     * visitor moves round, and advances their models. Call it with the
     * showcase's models, never from a view, since `onPlayEnded` changes one.
     */
    readonly update: (deltaMs: number) => void;
    /** Ends every attract session and removes their boxes from the overlay. */
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LiveEntriesHostOptions {
    /**
     * The showcase's own id. In the page, each entry starts with it as
     * `launchedBy`. So an entry that would reload the page to restart, such
     * as when the visitor changes a setting on its screen, restarts in place.
     */
    readonly showcaseId: string;
    /** The entry on each screen, by the screen's index. */
    readonly entries: readonly ArcadeEntry[];
    /** How the page launches an entry over the showcase. Absent outside the page. */
    readonly launcher: EntryLauncher | undefined;
    /**
     * How far the visitor is from the screen at `index`, in metres. Infinity
     * keeps it from running, such as while the visitor plays an entry, or
     * where the screen isn't there to see.
     */
    readonly distanceTo: (index: number) => number;
    /** How many screens run at once, at most. */
    readonly maxLive: number;
    /** A screen starts its entry within this distance of the visitor, and stops beyond the second, so stepping to and fro at the edge doesn't start and stop it. */
    readonly startDistance: number;
    readonly stopDistance: number;
    /** How long a game in attract mode stays on its game over screen before it starts again. */
    readonly gameOverMs: number;
    /**
     * The index of the screen whose entry the visitor plays now, once they
     * have stepped up to it, or undefined. Its entry launches as it turns up,
     * and launches again only after it has been undefined.
     */
    readonly indexInPlay: () => number | undefined;
    /** The visitor has left the entry launched, or it couldn't launch, so the showcase steps them back. */
    readonly onPlayEnded: () => void;
    /**
     * The index of the screen that holds the showcase itself, if one does,
     * such as the cabinet at the end of a 3D arcade. Its screen runs
     * `startOwnScreen`, not the entry. A showcase shown on its own screen
     * leaves out `startOwnScreen`, so that screen shows the entry's picture
     * rather than another showcase inside it, without end.
     */
    readonly ownIndex?: number;
    readonly startOwnScreen?: (stage: Container) => EntrySession;
    /**
     * The showcase's overlay (`PixiStartBase.overlay`), for entries that
     * bring their own renderer and draw with the DOM. Each runs in a box on
     * it, which a view lays over its screen. Without it, as when the showcase
     * runs headless, such an entry's screen shows its picture.
     */
    readonly overlay?: HTMLElement;
    /** How many entries that draw with the DOM run at once, at most, among the `maxLive`. 1 if absent. */
    readonly maxLiveElements?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a host. Attract sessions start as the visitor comes near the screens. */
export function createLiveEntriesHost(options: LiveEntriesHostOptions): LiveEntriesHost {
    const { showcaseId, entries, launcher, distanceTo, maxLive, startDistance, stopDistance, gameOverMs, indexInPlay, onPlayEnded, ownIndex, startOwnScreen, overlay } = options;
    const maxLiveElements = options.maxLiveElements ?? 1;
    // Only in the page, where there's a page to reload
    const launchedBy = launcher === undefined ? undefined : showcaseId;
    const count = entries.length;
    // Each screen's starter, once loaded, whether it's loading or failed to load, and the attract session running on it
    const starters: (EntryStarter | undefined)[] = new Array<EntryStarter | undefined>(count).fill(undefined);
    const isLoading: boolean[] = new Array<boolean>(count).fill(false);
    const isFailed: boolean[] = new Array<boolean>(count).fill(false);
    const sessions: (AttractSession | undefined)[] = new Array<AttractSession | undefined>(count).fill(undefined);
    // Which screens run an attract session this frame, worked out afresh each update
    const isWanted: boolean[] = new Array<boolean>(count).fill(false);
    const distances: number[] = new Array<number>(count).fill(0);
    /** How far the play of the entry stepped up to has got. It's idle again only once no screen is in play. */
    let play: 'idle' | 'launched' | 'ended' = 'idle';
    let isDestroyed = false;

    return {
        liveAt: (index) => sessions[index]?.live,
        playRectAt: (index) => launcher?.playRectFor(entries[index].id, starters[index]),

        update(deltaMs) {
            followEntryInPlay();
            chooseAttractSessions();
            for (let i = 0; i < count; i++) {
                if (sessions[i] !== undefined && !isWanted[i]) endSession(i);
                if (!isWanted[i] || sessions[i] !== undefined) continue;
                const starter = starters[i];
                if (i === ownIndex) startOwn();
                else if (starter === undefined) loadEntry(i);
                else startSession(i, starter);
            }
            for (let i = 0; i < count; i++) {
                const session = sessions[i];
                if (session !== undefined) advanceSession(i, session, deltaMs);
            }
        },

        destroy() {
            isDestroyed = true;
            for (let i = 0; i < count; i++) endSession(i);
        },
    };

    /**
     * Launches the entry once the visitor has stepped up to its screen, and
     * calls `onPlayEnded` once they have left it. The page launches it
     * between frames, so by the next update it's running, unless the page
     * couldn't launch it, which also ends the play.
     */
    function followEntryInPlay(): void {
        const index = indexInPlay();
        if (index === undefined) {
            play = 'idle';
            return;
        }
        if (play === 'ended') return;
        if (play === 'idle' && launcher !== undefined) {
            launcher.launch(entries[index].id);
            play = 'launched';
        }
        else if (launcher?.launchedId() !== entries[index].id) {
            play = 'ended';
            onPlayEnded();
        }
    }

    /**
     * Marks the nearest few screens in range to run in attract mode. A screen
     * already running keeps running a little further away than one starts.
     */
    function chooseAttractSessions(): void {
        isWanted.fill(false);
        for (let i = 0; i < count; i++) distances[i] = distanceTo(i);
        // Entries that draw with the DOM cost more, so fewer of them run at once
        let elementCount = 0;
        for (let picked = 0; picked < maxLive; picked++) {
            let nearest = -1;
            for (let i = 0; i < count; i++) {
                const range = sessions[i] === undefined ? startDistance : stopDistance;
                if (isWanted[i] || distances[i] > range || !canRunLive(i)) continue;
                if (isElementEntry(i) && elementCount >= maxLiveElements) continue;
                if (nearest < 0 || distances[i] < distances[nearest]) nearest = i;
            }
            if (nearest < 0) return;
            isWanted[nearest] = true;
            if (isElementEntry(nearest)) elementCount++;
        }
    }

    /** Whether the entry at `index` brings its own renderer, once its code has loaded and if the showcase can show it live. */
    function isElementEntry(index: number): boolean {
        return overlay !== undefined && starters[index]?.kind === 'element';
    }

    /** Whether the screen at `index` can run live, so it's worth one of the `maxLive`. Its screen shows its picture otherwise. */
    function canRunLive(index: number): boolean {
        if (index === ownIndex) return startOwnScreen !== undefined;
        if (isFailed[index]) return false;
        return overlay !== undefined || starters[index]?.kind !== 'element';
    }

    /** Loads the entry at `index`. One that fails to load shows its picture from then on. */
    function loadEntry(index: number): void {
        if (isLoading[index] || isFailed[index]) return;
        isLoading[index] = true;
        entries[index].load().then((starter) => {
            isLoading[index] = false;
            if (!isDestroyed) starters[index] = starter;
        }).catch((error: unknown) => {
            isLoading[index] = false;
            isFailed[index] = true;
            console.warn(`${entries[index].name} could not be loaded onto its screen.`, error);
        });
    }

    /** Starts the showcase itself on its own screen. It doesn't need a pilot, and it's silent. */
    function startOwn(): void {
        if (startOwnScreen === undefined || ownIndex === undefined) return;
        const stage = new Container();
        sessions[ownIndex] = {
            session: startOwnScreen(stage),
            controls: undefined,
            silentChips: [],
            pilot: undefined,
            overMs: 0,
            live: { stage, width: entries[ownIndex].screenWidth, height: entries[ownIndex].screenHeight, isPixelArt: false },
        };
    }

    function startSession(index: number, starter: EntryStarter): void {
        // Only a Pixi entry can draw on a container. One that brings its own renderer runs on the overlay, if
        // there is one, or shows its picture instead
        if (starter.kind === 'element') {
            if (overlay !== undefined) startElementSession(index, starter, overlay);
            return;
        }
        const entry = entries[index];
        const stage = new Container();
        const controls = createArcadeControls();
        const silentChips: SilentChip[] = [];
        const findChips = createSilentChipFinder(silentChips);
        // An entry's textures are made as it starts, with Pixi's default scaling,
        // which the page sets for each entry. The showcase's is smooth, so a
        // pixel-art entry's is set to hard edges while it starts, then put back
        const previousScaleMode = TextureSource.defaultOptions.scaleMode;
        TextureSource.defaultOptions.scaleMode = starter.pixelArt === true ? 'nearest' : 'linear';
        let session: EntrySession;
        try {
            starter.fitTo?.(entry.screenWidth, entry.screenHeight);
            session = startPixiEntry(starter, { stage, controls, launchedBy }, findChips);
        }
        finally {
            TextureSource.defaultOptions.scaleMode = previousScaleMode;
        }
        sessions[index] = {
            session,
            controls,
            silentChips,
            // A pilot plays the arcade controls, so an entry that ignores them runs on its own
            pilot: starter.arcadeControls === undefined ? undefined : createAttractPilot({ seed: PILOT_SEED + index }),
            overMs: 0,
            live: { stage, width: starter.screenWidth, height: starter.screenHeight, isPixelArt: starter.pixelArt === true },
        };
    }

    /**
     * Starts an entry that brings its own renderer in a box on the overlay,
     * the size of its play area, which a view lays over its screen. It's
     * built hidden, and it never listens to the keyboard, which walks the
     * visitor round. It may receive pointer events, which a view allows only
     * while the visitor stands at its screen.
     */
    function startElementSession(index: number, starter: ElementEntryStarter, into: HTMLElement): void {
        const entry = entries[index];
        const box = document.createElement('div');
        box.className = 'showcase-live-element';
        box.style.width = `${entry.screenWidth}px`;
        box.style.height = `${entry.screenHeight}px`;
        into.append(box);
        const controls = createArcadeControls();
        const silentChips: SilentChip[] = [];
        const session = startElementEntry(starter, { element: box, takesInput: false, controls, launchedBy }, createSilentChipFinder(silentChips));
        sessions[index] = {
            session,
            controls,
            silentChips,
            pilot: starter.arcadeControls === undefined ? undefined : createAttractPilot({ seed: PILOT_SEED + index }),
            overMs: 0,
            live: { stage: new Container(), width: entry.screenWidth, height: entry.screenHeight, isPixelArt: false, element: box, elementSession: session },
        };
    }

    function advanceSession(index: number, attract: AttractSession, deltaMs: number): void {
        if (attract.controls !== undefined) attract.pilot?.steer(attract.controls, deltaMs);
        // Its models alone. Its views tick with the showcase's views, on its screen
        attract.session.update(deltaMs);
        for (let i = 0; i < attract.silentChips.length; i++) attract.silentChips[i].update(deltaMs);
        // A game that has ended starts again, after a moment on its game over screen
        attract.overMs = attract.session.scoring?.isOver() === true ? attract.overMs + deltaMs : 0;
        if (attract.overMs > gameOverMs) endSession(index);
    }

    function endSession(index: number): void {
        const attract = sessions[index];
        if (attract === undefined) return;
        sessions[index] = undefined;
        attract.session.destroy();
        attract.controls?.destroy();
        // The screen's texture destroys the stage, once the screen finds the entry gone. Destroying it twice is safe
        attract.live.stage.destroy();
        attract.live.element?.remove();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Finds silent chips for an entry that plays on one, and adds each to `into`, to keep its time with the entry. */
function createSilentChipFinder(into: SilentChip[]): SoundChipFinder {
    return <K extends SoundChipKind>(kind: K): SessionChips<K> => {
        const silent = kind === 'audio80'
            ? { music: createHeadlessAudio80(), sfx: createHeadlessAudio80() }
            : { music: createHeadlessAudio90(), sfx: createHeadlessAudio90() };
        into.push(silent.music, silent.sfx);
        return silent as unknown as SessionChips<K>;
    };
}

interface AttractSession {
    readonly session: EntrySession;
    /** The controls the entry was passed, if it was passed any. */
    readonly controls: ArcadeControls | undefined;
    /** The entry's chips, which are silent, and keep its music's time with the entry. */
    readonly silentChips: readonly SilentChip[];
    /** The pilot that plays it, for a game that uses the arcade controls. */
    readonly pilot: AttractPilot | undefined;
    /** How long it has been over. */
    overMs: number;
    /** The entry as its screen shows it. */
    readonly live: LiveEntry;
}

interface SilentChip {
    readonly update: (deltaMs: number) => void;
}

const PILOT_SEED = 4321;
