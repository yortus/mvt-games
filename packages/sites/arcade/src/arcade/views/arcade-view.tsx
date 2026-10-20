/** @jsxImportSource @mvtjs/html */
import type { Audio80 } from '@mvtjs/chiptune';
import { destroyElement, Match, Switch } from '@mvtjs/html';
import { assert, memoiseLast, type MetricKind, type PerformanceMetrics, watch } from '@mvtjs/utils';
import type { ArcadeEntry, EntryDetails, EntryStarter } from '../../entry-types';
import type { ArcadeModel } from '../models';
import { AboutView } from './about-view';
import { ArcadeHeadView } from './arcade-head-view';
import { cardHeightFor, frameForCrop, type PhotoPose } from './card-photo';
import { createCardWallLayout } from './card-wall-layout';
import { CardWallView, photoPoseIn } from './card-wall-view';
import { EntryInfoView } from './entry-info-view';
import type { ArcadeAudioViews } from './load-arcade-audio-views';
import type { Perfmon } from './load-perfmon';
import { NavPerfmonView } from './nav-perfmon-view';
import { NavSearchView } from './nav-search-view';
import { NavSoundView } from './nav-sound-view';
import { PlacingView } from './placing-view';
import { NO_RECT, type Rect } from './rect';
import { ResumeOfferView } from './resume-offer-view';
import { RunnerView } from './runner-view';
import { EntryTransitionView } from './entry-transition-view';
import { createEntryTransitionViewModel, type PicturePose } from './entry-transition-view-model';
import { WallEffectView } from './wall-effect-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The Arcade's model, and what the page gives the Arcade's view besides. */
export interface ArcadeViewBindings {
    /** The Arcade's model. */
    readonly model: ArcadeModel;
    /** The element entries play in, which the page's entry host fills. */
    readonly stage: HTMLElement;
    /** Where an entry would play, in the viewport, as the page's entry host would fit it. */
    readonly playRectFor: (entry: ArcadeEntry, starter: EntryStarter | undefined) => Rect;
    /** The last frame of the entry just left, for the way back out, if its renderer gave one. */
    readonly exitFrame: () => HTMLCanvasElement | undefined;
    /** Whether the visitor has asked their system for less motion (`prefers-reduced-motion`). */
    readonly isMotionReduced: () => boolean;
    /**
     * The element the page plays an entry live in, on its card (attract
     * mode), drawn at the entry's play size. Absent where the page plays
     * none, as on a touch screen.
     */
    readonly liveElement?: HTMLElement;
    /** The entry the page is playing live, if any. */
    readonly liveEntry: () => ArcadeEntry | undefined;
    /** Whether the entry playing live has drawn enough to show. */
    readonly isLiveShowing: () => boolean;
    /** Reported with the entry whose card wants to play it live, or undefined for none, as it changes. */
    readonly onLiveWanted?: (entry: ArcadeEntry | undefined) => void;
    /**
     * A place in the site's nav for the Arcade's own tools, if the page has
     * one. A magnifier there takes a visitor scrolled down the wall back to
     * the search. A speaker there turns all the sound off, or back on. A
     * gauge opens the Perfmon, and an (i) opens a note about the Arcade. The
     * page ticks them with the rest of its views.
     */
    readonly navTools?: HTMLElement;
    /**
     * The site nav's links to the Arcade itself: the site's name and the
     * Arcade's link. The page is already the Arcade, so a click on one
     * scrolls back to the top of the wall, closing any panel open, rather
     * than loading the page again. A click that opens a new tab still does.
     */
    readonly homeLinks?: readonly HTMLElement[];
    /**
     * The page's own chip. It plays whether an entry runs, is paused or is
     * held. The Arcade's own sounds and the pause menu's volume previews play
     * on it. Read once.
     */
    readonly pageSound: Audio80;
    /**
     * The views that play the Arcade's own sounds, once the page has loaded
     * them. It is undefined until then, and none of the Arcade's sounds play.
     * Browsers play no sound before the visitor's first press, so the page
     * loads them on that press, and its first load holds no sound.
     */
    readonly audioViews: () => ArcadeAudioViews | undefined;
    /**
     * Whether all the sound is muted because the visit started that way, as
     * a first visit on a phone does, and the visitor has not changed it. A
     * hint then offers to turn the sound on as an entry plays.
     */
    readonly isSoundOffByDefault: () => boolean;
    /**
     * Whether the runner is turned a quarter turn clockwise, for a game wider
     * than tall on a phone held upright. Its bar, its stage and everything
     * over them then show for the phone turned on its side.
     */
    readonly isTurned: () => boolean;
    /** The address of `entry`, for its card's link, so a middle click opens the entry in a new tab. Read once for each entry. */
    readonly entryHref: (entry: ArcadeEntry) => string;
    /** The address of the docs, which the Arcade's own info panel links to. Read once. */
    readonly docsHref: string;
    /** How fast the page runs, which the Perfmon shows. Undefined while there is nothing to show, as while it is closed. */
    readonly performance: () => PerformanceMetrics | undefined;
    /** The metrics the page can't measure as things stand, such as the GPU's time for an entry not drawn with Pixi. The Perfmon shows them as n/a. */
    readonly unmeasuredMetrics: () => readonly MetricKind[];
    /** How many times the music has stalled since the page loaded, which the Perfmon shows. */
    readonly stallCount: () => number;
    /**
     * The Perfmon's panel, once the page has loaded it. It is undefined until
     * then. The page loads it the first time the Perfmon opens, so its first
     * load holds none of it.
     */
    readonly perfmon: () => Perfmon | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows the Arcade. It has a head, with the Arcade's name and a search over
 * its entries. Below is a wall of cards for the entries the search picks, in
 * order of name. It also has an entry's info panel, and the runner an entry
 * plays in.
 *
 * Choosing an entry burns the other cards away around its polaroid while it
 * loads. Then the polaroid recedes and the entry's screen powers on. Leaving
 * the entry powers the screen off, and the polaroid comes back as the cards
 * develop. The transition and the wall's layout are this view's
 * presentation state, in view models it owns.
 *
 * A magnifier in the site's nav opens the search, in the head, as `/` does
 * from anywhere on the wall, scrolling back up to it, or closes it while it
 * is empty. The search shows while it is open, or while it holds something,
 * so a narrowed wall always says why. A speaker
 * in the site's nav, and another in the runner's bar, turns all the sound
 * off, or back on at the levels it had. A gauge beside each opens the
 * Perfmon, over the wall or the entry playing. It drops at the top right,
 * under the bar, and the visitor can drag it anywhere. An (i) at the nav's right end opens a note about the Arcade. The
 * Arcade's own sounds play from audio views that load on the visitor's first
 * press.
 */
export function ArcadeView(bindings: ArcadeViewBindings): Element {
    const { model } = bindings;
    const { entries, highscores } = model;
    /** The long text of `entry`, once it has loaded. */
    const detailsOf = (entry: ArcadeEntry | undefined): EntryDetails | undefined => (entry === undefined ? undefined : model.detailsFor(entry.id));

    const layout = createCardWallLayout({
        count: entries.length,
        gap: CARD_GAP,
        minColumnWidth: MIN_COLUMN_WIDTH,
        minColumnCount: MIN_COLUMN_COUNT,
        maxColumnCount: MAX_COLUMN_COUNT,
        shownCount: () => model.shownCount,
        shownIndexAt: model.shownIndexAt,
        estimatedHeightAt: (_index, columnWidth) => cardHeightFor(columnWidth),
        isMotionReduced: bindings.isMotionReduced,
    });
    // Presentation state: how many times the keyboard has moved the selection to another card.
    // The Arcade's audio view ticks each time it rises.
    let cardKeyMoves = 0;
    const transition = createEntryTransitionViewModel({
        target: playRect,
        turn: () => (bindings.isTurned() ? 90 : 0),
        arcadePhase: () => model.phase,
        arcadeElapsedMs: () => model.elapsedMs,
        isMotionReduced: bindings.isMotionReduced,
    });
    const phaseWatcher = watch({ phase: () => model.phase });
    phaseWatcher.poll();
    // A link straight to an entry launches it before there is a wall to leave
    if (model.phase !== 'browsing') transition.holdGrown();
    /** The picture on the card launched, for the way in to start from as the launch begins. */
    let launchedFrom: PicturePose | undefined;
    let isScrollLockDrawn = false;
    let isTurnDrawn = false;
    // Presentation state: whether the entry was paused by its info panel opening over it, to resume as the panel closes
    let isPausedForInfo = false;

    const wall = CardWallView({
        entries,
        layout,
        hrefAt: (index) => bindings.entryHref(entries[index]),
        shownCount: () => model.shownCount,
        shownIndexAt: model.shownIndexAt,
        liftedIndex: () => (transition.phase === 'idle' && model.phase === 'browsing' ? -1 : activeIndex()),
        isActive: isWallActive,
        isMotionReduced: bindings.isMotionReduced,
        canPlayLive: () => bindings.liveElement !== undefined && !bindings.isMotionReduced() && isWallActive(),
        liveIndex: () => indexOf(bindings.liveEntry()),
        liveElement: bindings.liveElement,
        isLiveShowing: bindings.isLiveShowing,
        onLiveWanted: (index) => bindings.onLiveWanted?.(entries[index]),
        onLaunchPressed: (index, from) => launch(index, from),
        onInfoPressed: (index) => model.openInfo(entries[index].id),
        isFavouriteAt: (index) => model.isFavourite(entries[index].id),
        onFavouritePressed: (index) => model.toggleFavourite(entries[index].id),
        onCardKeyedTo: () => { cardKeyMoves++; },
    });
    const failureText = memoiseLast((failure: string | undefined) => failure ?? '');

    // Presentation state: whether the visitor has opened the search box, and
    // how many times the caret has been asked for in it. The box also shows
    // while it holds something, so a search that narrows the wall is in view
    let isSearchOpen = false;
    let searchFocusRequests = 0;
    const head = ArcadeHeadView({
        model,
        isSearchShown,
        searchFocusRequests: () => searchFocusRequests,
        // An empty box closes as it is left. One that holds something stays, so the wall says why it is narrowed
        onSearchLeft: () => { isSearchOpen = false; },
    });
    const navSearch = NavSearchView({
        isOn: isSearchShown,
        shownCount: () => model.shownCount,
        totalCount: entries.length,
        onPressed: toggleSearch,
    });
    // The speaker mutes all the sound, the music and the effects, so a game started next is silent too.
    // Pressed again, it unmutes, and each sound plays at the level it had. A press on a speaker that
    // shows the sound off always brings sound back: if both sounds are at 0, it turns both on
    const navSound = NavSoundView({
        isOn: isAnySoundOn,
        onPressed: toggleAllSound,
    });
    const navPerfmon = NavPerfmonView({
        isOpen: () => model.isPerfmonOpen,
        onPressed: togglePerfmon,
    });
    const about = AboutView({
        docsHref: bindings.docsHref,
        isOpen: () => model.isAboutOpen,
        onAboutPressed: toggleAbout,
        onDismissed: model.closeAbout,
    });
    bindings.navTools?.append(navSearch, navSound, navPerfmon, about);

    window.addEventListener('keydown', onKeyDown);
    const homeLinks = bindings.homeLinks ?? [];
    for (const link of homeLinks) link.addEventListener('click', goHome);

    return (
        <div
            class="arcade"
            onUpdate={update}
            onRefresh={drawPage}
            onDestroyed={stopListening}
        >
            {head}
            <div class="card-wall-frame">
                {wall}
                <p class="card-wall-empty" visible={() => model.shownCount === 0} text="Nothing matches this search." />
            </div>
            <WallEffectView
                effect={() => transition.wallEffect}
                cardCount={() => transition.cardCount}
                cardRectAt={transition.cardRectAt}
                cardProgressAt={transition.cardProgressAt}
            />
            <div class="toast" role="status" visible={() => model.loadFailure !== undefined}>
                <span text={() => failureText(model.loadFailure)} />
                <button type="button" aria-label="Dismiss" text="×" onClick={model.dismissLoadFailure} />
            </div>
            <EntryInfoView
                entry={() => model.infoEntry}
                details={() => detailsOf(model.infoEntry)}
                factsFor={model.factsFor}
                highscoreRowsFor={highscores.tableFor}
                highscoresStatus={() => highscores.status}
                isOverEntry={isInfoOverEntry}
                onClosePressed={closeInfo}
                onPlayPressed={(id) => {
                    // Over the entry, the button resumes it
                    if (isInfoOverEntry()) {
                        closeInfo();
                        return;
                    }
                    const index = entries.findIndex((e) => e.id === id);
                    launch(index, cardPoseAt(index));
                }}
            />
            <Switch>
                <Match when={() => bindings.audioViews() !== undefined}>{AudioView}</Match>
            </Switch>
            <RunnerView
                stage={bindings.stage}
                isOpen={() => model.phase !== 'browsing'}
                isPlaying={isEntryShown}
                isPaused={() => model.isPaused}
                isInfoOpen={isInfoOverEntry}
                onInfoPressed={toggleInfoOverEntry}
                // The runner's bar covers the site's nav, so it has a speaker of its own, the same as the nav's
                isSoundOn={isAnySoundOn}
                isSoundOffByDefault={bindings.isSoundOffByDefault}
                onSoundPressed={toggleAllSound}
                isPerfmonOpen={() => model.isPerfmonOpen}
                onPerfmonPressed={togglePerfmon}
                // While all the sound is muted, the pause menu shows each sound as off.
                // Using a slider or an icon there unmutes the sound first.
                musicVolume={() => (model.isSoundMuted ? 0 : model.musicVolume)}
                effectsVolume={() => (model.isSoundMuted ? 0 : model.effectsVolume)}
                onMusicVolumeChanged={(volume) => {
                    model.isSoundMuted = false;
                    model.musicVolume = volume;
                }}
                onMusicIconPressed={() => toggleSound(model.musicVolume, model.turnMusicOn, model.turnMusicOff)}
                onEffectsVolumeChanged={(volume) => {
                    model.isSoundMuted = false;
                    model.effectsVolume = volume;
                }}
                onEffectsIconPressed={() => toggleSound(model.effectsVolume, model.turnEffectsOn, model.turnEffectsOff)}
                title={() => model.activeEntry?.name ?? ''}
                isGame={() => model.activeEntry?.tags.kind === 'game'}
                isLandscape={() => (model.activeEntry?.screenWidth ?? 0) > (model.activeEntry?.screenHeight ?? 0)}
                isTurned={bindings.isTurned}
                onBackPressed={leaveEntry}
                onPausePressed={() => { model.isPaused = true; }}
                onResumePressed={() => {
                    closeInfo();
                    model.isPaused = false;
                }}
                onRestartPressed={model.restart}
            />
            <Switch>
                <Match when={() => bindings.perfmon() !== undefined}>{PerfmonPanelView}</Match>
            </Switch>
            <ResumeOfferView
                isOpen={() => isEntryShown() && model.isResumeOffered}
                title={() => model.activeEntry?.name ?? ''}
                onResumePressed={model.resume}
                onRestartPressed={model.startAfresh}
            />
            <PlacingView
                placing={() => highscores.placing}
                score={() => highscores.placingScore}
                rank={() => highscores.placingRank}
                problem={() => highscores.placingProblem}
                rows={() => highscores.tableFor(highscores.placingEntryId ?? '')}
                rememberedInitials={() => highscores.lastInitials}
                onInitialsEntered={highscores.submitInitials}
                onSkipPressed={highscores.close}
                onContinuePressed={highscores.close}
            />
            <EntryTransitionView
                transition={transition}
                thumbnail={() => model.activeEntry?.thumbnail ?? ''}
                frame={() => (model.phase === 'browsing' ? bindings.exitFrame() : undefined)}
                isPixelArt={() => model.activeEntry?.tags.kind === 'game'}
                stage={bindings.stage}
            />
        </div>
    );

    /** Builds the Perfmon's floating panel. It runs once, when the Perfmon has loaded. */
    function PerfmonPanelView(): Element {
        const perfmon = bindings.perfmon();
        assert(perfmon !== undefined, 'arcade: the Perfmon\'s panel is built only once it has loaded');
        return perfmon.PerfmonFloatView({
            isOpen: () => model.isPerfmonOpen,
            metrics: bindings.performance,
            unmeasured: bindings.unmeasuredMetrics,
            stallCount: bindings.stallCount,
        });
    }

    /**
     * Builds the views that play the Arcade's sounds and the pause menu's
     * volume previews. It runs once, when they have loaded. Each view hears
     * only the changes after it is built, so nothing that happened before
     * plays late.
     */
    function AudioView(): Element {
        const views = bindings.audioViews();
        assert(views !== undefined, 'arcade: the audio views are built only once they have loaded');
        return (
            <div class="arcade-audio-views">
                {views.ArcadeAudioView({
                    sound: bindings.pageSound,
                    phase: () => model.phase,
                    isPaused: () => model.isPaused,
                    isPanelOpen: () => model.infoEntry !== undefined || model.isAboutOpen,
                    searchText: () => model.searchText,
                    chosenTagCount: () => model.activeChipCount,
                    shownCount: () => model.shownCount,
                    loadFailure: () => model.loadFailure,
                    transitionPhase: () => transition.phase,
                    isBeamOn: () => transition.isBeamOn,
                    wallEffect: () => transition.wallEffect,
                    cardKeyMoves: () => cardKeyMoves,
                })}
                {views.VolumePreviewAudioView({
                    sound: bindings.pageSound,
                    // The pause menu is open while the entry is paused.
                    isOpen: () => model.isPaused,
                    musicVolume: () => model.musicVolume,
                    effectsVolume: () => model.effectsVolume,
                })}
            </div>
        );
    }

    /** Starts the transition in or out as the phase changes, then advances it. */
    function update(deltaMs: number): void {
        const { phase } = phaseWatcher.poll();
        if (phase.changed) {
            if (phase.previous === 'browsing') {
                if (launchedFrom === undefined) transition.holdGrown();
                else transition.enterFrom(launchedFrom, cardRects());
                launchedFrom = undefined;
            }
            else if (phase.value === 'browsing') {
                transition.leaveTo(cardPictureAt(activeIndex()), cardRects());
            }
        }
        transition.update(deltaMs);
    }

    /**
     * Launches entry `index`, its card's photo drawn at `from`, for the way in
     * to start from. Kept only if the launch begins: a refused one must not
     * leave its picture for a later launch, from the URL, to start from.
     */
    function launch(index: number, from: PhotoPose | undefined): void {
        const entry = entries[index];
        if (entry === undefined) return;
        launchedFrom = from === undefined ? undefined : { ...from, frame: frameForCrop(entry, from.window) };
        model.launch(entry.id);
        if (model.phase !== 'launching') launchedFrom = undefined;
    }

    /** Whether the wall is what the visitor is looking at: browsing, with no panel or transition over it. */
    function isWallActive(): boolean {
        return model.phase === 'browsing' && model.infoEntry === undefined && transition.phase === 'idle';
    }

    /** Writes what the Arcade sets on the whole page: the scroll lock, and the runner's turn. */
    function drawPage(): void {
        lockScroll();
        drawTurn();
    }

    /**
     * Marks the page while the runner is turned. The stylesheet turns each of
     * the runner's layers, and each layer over them, as the page's mark says.
     */
    function drawTurn(): void {
        const isTurned = bindings.isTurned();
        if (isTurned === isTurnDrawn) return;
        isTurnDrawn = isTurned;
        document.documentElement.classList.toggle('is-runner-turned', isTurned);
    }

    /**
     * While an entry plays, and until the way back has ended, the page under
     * it stays put: it keeps its place for the way back, and the polaroid and
     * the cards developing stay where the transition put them. Under an info
     * panel too, which scrolls on its own, the wall stays where it was.
     */
    function lockScroll(): void {
        const isLocked = model.phase !== 'browsing' || transition.phase !== 'idle' || model.infoEntry !== undefined;
        if (isLocked === isScrollLockDrawn) return;
        isScrollLockDrawn = isLocked;
        document.documentElement.classList.toggle('is-scroll-locked', isLocked);
    }

    /** Scrolls back up to the head, and puts the caret in the search, which opens its tags. */
    /** Scrolls back to the top of the wall, with no panel open, for a plain click on a link to the Arcade. */
    function goHome(e: MouseEvent): void {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        model.closeInfo();
        model.closeAbout();
        window.scrollTo({ top: 0, behavior: bindings.isMotionReduced() ? 'auto' : 'smooth' });
    }

    /** Whether the search box shows: opened by the visitor, or holding a search. */
    function isSearchShown(): boolean {
        return isSearchOpen || model.searchText !== '' || model.activeChipCount > 0;
    }

    /**
     * The nav's magnifier: closes the search box while it shows empty, and
     * otherwise goes to it, opening it.
     */
    function toggleSearch(): void {
        const isEmpty = model.searchText === '' && model.activeChipCount === 0;
        if (isSearchShown() && isEmpty) {
            isSearchOpen = false;
            head.querySelector<HTMLInputElement>('.search-input')?.blur();
            return;
        }
        goToSearch();
    }

    /** Scrolls back up to the head, opens the search box, and puts the caret in it, which opens its tags. */
    function goToSearch(): void {
        isSearchOpen = true;
        searchFocusRequests++;
        window.scrollTo({ top: 0, behavior: bindings.isMotionReduced() ? 'auto' : 'smooth' });
    }

    function stopListening(): void {
        window.removeEventListener('keydown', onKeyDown);
        for (const link of homeLinks) link.removeEventListener('click', goHome);
        // In the site's nav, outside this view: destroyed with it, which takes it out of the nav
        destroyElement(navSearch);
        destroyElement(navSound);
        destroyElement(navPerfmon);
        destroyElement(about);
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key === '/') jumpToSearch(e);
        else if (e.key === 'Escape') stepBack(e);
    }

    /** `/` goes to the search, as the nav's magnifier does, from anywhere on the wall but a field. */
    function jumpToSearch(e: KeyboardEvent): void {
        if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target ?? undefined) || !isWallActive()) return;
        e.preventDefault();
        goToSearch();
    }

    /**
     * Escape closes the info panel, pauses or resumes the entry playing (a
     * game or a demo, alike), or leaves one still on its way in. Not while a score
     * places, or while a saved game is offered: their views have the keys then.
     */
    function stepBack(e: KeyboardEvent): void {
        if (highscores.placing !== 'none' || model.isResumeOffered) return;
        if (model.infoEntry !== undefined) closeInfo();
        else if (model.phase === 'playing') model.isPaused = !model.isPaused;
        else if (model.phase !== 'browsing') model.exit();
        else return;
        e.preventDefault();
    }

    /**
     * Whether the entry is on the screen: started, and no longer behind the
     * polaroid receding on the way in. The runner shows it, and its offer to
     * resume a saved game, from then on.
     */
    function isEntryShown(): boolean {
        return model.isEntryStarted && transition.phase !== 'receding';
    }

    /** Whether the entry's info panel is open over the entry, which is paused behind it. */
    function isInfoOverEntry(): boolean {
        return model.infoEntry !== undefined && model.phase !== 'browsing';
    }

    /**
     * Opens the entry's info panel over it, from the runner's (i), or closes
     * it. Opening it pauses the entry, if it plays, and closing it resumes
     * the entry, if the panel paused it: one the visitor paused stays paused.
     */
    function toggleInfoOverEntry(): void {
        if (isInfoOverEntry()) {
            closeInfo();
            return;
        }
        const entry = model.activeEntry;
        if (entry === undefined) return;
        if (model.isEntryStarted && !model.isPaused) {
            model.isPaused = true;
            isPausedForInfo = true;
        }
        model.openInfo(entry.id);
    }

    /** Closes an info panel, and resumes the entry under it, if the panel paused it. */
    function closeInfo(): void {
        model.closeInfo();
        if (!isPausedForInfo) return;
        isPausedForInfo = false;
        if (model.isEntryStarted) model.isPaused = false;
    }

    /** Leaves the entry, from the runner's back button or the pause menu's Exit, closing its info panel, if open, first. */
    function leaveEntry(): void {
        isPausedForInfo = false;
        if (isInfoOverEntry()) model.closeInfo();
        model.exit();
    }

    function togglePerfmon(): void {
        model.isPerfmonOpen = !model.isPerfmonOpen;
    }

    function toggleAbout(): void {
        if (model.isAboutOpen) model.closeAbout();
        else model.openAbout();
    }

    /**
     * Mutes all the sound if any plays. Otherwise unmutes it. If both sounds
     * are at 0 even so, it turns both on, each at the level it had before it
     * was turned off, or at the default.
     */
    function toggleAllSound(): void {
        if (isAnySoundOn()) {
            model.isSoundMuted = true;
            return;
        }
        model.isSoundMuted = false;
        if (model.musicVolume === 0 && model.effectsVolume === 0) {
            model.turnMusicOn();
            model.turnEffectsOn();
        }
    }

    /** Whether any sound plays, the music or the effects, with all the sound unmuted. */
    function isAnySoundOn(): boolean {
        return !model.isSoundMuted && (model.musicVolume > 0 || model.effectsVolume > 0);
    }

    /**
     * Turns a sound off as its icon is pressed, or on again at the level it
     * had. While all the sound is muted, each sound shows as off, so pressing
     * an icon unmutes the sound and turns that sound on.
     */
    function toggleSound(volume: number, turnOn: () => void, turnOff: () => void): void {
        if (model.isSoundMuted || volume === 0) {
            model.isSoundMuted = false;
            turnOn();
        }
        else {
            turnOff();
        }
    }

    function activeIndex(): number {
        return indexOf(model.activeEntry);
    }

    function indexOf(entry: ArcadeEntry | undefined): number {
        return entry === undefined ? -1 : entries.indexOf(entry);
    }

    function playRect(): Rect {
        const entry = model.activeEntry;
        return entry === undefined ? NO_RECT : bindings.playRectFor(entry, model.starter);
    }

    /**
     * Every card's rectangle in the viewport, zero-sized for those not on
     * the wall: what the transition burns and develops. Read when it starts.
     */
    function cardRects(): Rect[] {
        const bounds = wall.getBoundingClientRect();
        const height = cardHeightFor(layout.columnWidth);
        return entries.map((_entry, index) => (layout.isVisibleAt(index) && layout.opacityAt(index) > 0
            ? { x: bounds.left + layout.xAt(index), y: bounds.top + layout.yAt(index), width: layout.columnWidth, height }
            : NO_RECT));
    }

    /**
     * Card `index`'s photo, if it is on the wall, as it is drawn now: tilted
     * at rest, or straight and closer while selected. Read when a transition
     * starts, so the way back lands on the polaroid as the card shows it.
     */
    function cardPoseAt(index: number): PhotoPose | undefined {
        return index < 0 || !layout.isVisibleAt(index) ? undefined : photoPoseIn(wall, entries[index].id);
    }

    /** Card `index`'s photo, with the whole thumbnail behind it. */
    function cardPictureAt(index: number): PicturePose | undefined {
        const pose = cardPoseAt(index);
        return pose === undefined ? undefined : { ...pose, frame: frameForCrop(entries[index], pose.window) };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CARD_GAP = 16;
const MIN_COLUMN_WIDTH = 260;
/** Two columns even on a phone: the cards narrow to fit, rather than one filling the screen. */
const MIN_COLUMN_COUNT = 2;
const MAX_COLUMN_COUNT = 5;

function isTyping(target: EventTarget | undefined): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
}
