/** @jsxImportSource @mvtjs/html */
import { memoiseLast, watch } from '@mvtjs/utils';
import type { ArcadeEntry, EntryStarter } from '../../entries';
import type { ArcadeModel } from '../models';
import { ArcadeHeadView } from './arcade-head-view';
import { cardHeightFor, frameForCrop, type PhotoPose } from './card-photo';
import { createCardWallLayout } from './card-wall-layout';
import { CardWallView, photoPoseIn } from './card-wall-view';
import { EntryInfoView } from './entry-info-view';
import { NO_RECT, type Rect } from './rect';
import { RunnerView } from './runner-view';
import { TransitionView } from './transition-view';
import { createTransitionViewModel, type PicturePose } from './transition-view-model';
import { WallEffectView } from './wall-effect-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ArcadeViewBindings {
    readonly model: ArcadeModel;
    /** The element entries play in, which the page's entry host fills. */
    readonly stage: HTMLElement;
    /** Where an entry would play, in the viewport, as the page's entry host would fit it. */
    readonly playRectFor: (entry: ArcadeEntry, starter: EntryStarter | undefined) => Rect;
    /** The last frame of the entry just left, for the way back out, if its renderer gave one. */
    readonly exitFrame: () => HTMLCanvasElement | undefined;
    /** Whether the visitor has asked their system for less motion (`prefers-reduced-motion`). */
    readonly isMotionReduced: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The arcade: its head (its name and a search over its entries), a wall of
 * cards for the entries it picks, by name, an entry's info panel, and the
 * runner an entry plays in. Choosing an entry burns the other cards away
 * around its polaroid while it loads, then the polaroid recedes and the
 * entry's screen powers on; leaving it powers the screen off, and the
 * polaroid comes back as the cards develop. The transition and the wall's
 * layout are this view's presentation state, in view models it owns.
 */
export function ArcadeView(bindings: ArcadeViewBindings): Element {
    const { model } = bindings;
    const { entries } = model;

    const layout = createCardWallLayout({
        count: entries.length,
        gap: CARD_GAP,
        minColumnWidth: MIN_COLUMN_WIDTH,
        maxColumnCount: MAX_COLUMN_COUNT,
        shownCount: () => model.shownCount,
        shownIndexAt: model.shownIndexAt,
        estimatedHeightAt: (_index, columnWidth) => cardHeightFor(columnWidth),
        isMotionReduced: bindings.isMotionReduced,
    });
    const transition = createTransitionViewModel({
        target: playRect,
        isReady: () => model.phase === 'ready',
        isPlaying: () => model.phase === 'playing',
        onHandOver: model.startPlaying,
        isMotionReduced: bindings.isMotionReduced,
    });
    const phaseWatcher = watch({ phase: () => model.phase });
    phaseWatcher.poll();
    // A link straight to an entry launches it before there is a wall to leave
    if (model.phase !== 'browsing') transition.holdGrown();
    /** The picture on the card launched, for the way in to start from as the launch begins. */
    let launchedFrom: PicturePose | undefined;
    let isPlayingDrawn = false;

    const wall = CardWallView({
        entries,
        layout,
        shownCount: () => model.shownCount,
        shownIndexAt: model.shownIndexAt,
        liftedIndex: () => (transition.phase === 'idle' && model.phase === 'browsing' ? -1 : activeIndex()),
        isActive: isWallActive,
        isMotionReduced: bindings.isMotionReduced,
        onLaunchPressed: (index, from) => launch(index, from),
        onInfoPressed: (index) => model.openInfo(entries[index].id),
    });
    const failureText = memoiseLast((failure: string | undefined) => failure ?? '');

    window.addEventListener('keydown', onKeyDown);

    return (
        <div
            class="arcade"
            onUpdate={update}
            onRefresh={lockScrollWhilePlaying}
            onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}
        >
            <ArcadeHeadView model={model} isActive={isWallActive} />
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
                factsFor={model.factsFor}
                onClosePressed={model.closeInfo}
                onPlayPressed={(id) => {
                    const index = entries.findIndex((e) => e.id === id);
                    launch(index, cardPoseAt(index));
                }}
            />
            <RunnerView
                stage={bindings.stage}
                isOpen={() => model.phase !== 'browsing'}
                isPlaying={() => model.phase === 'playing'}
                isPaused={() => model.isPaused}
                title={() => model.activeEntry?.name ?? ''}
                instructions={() => model.activeEntry?.instructions}
                isLandscape={() => (model.activeEntry?.screenWidth ?? 0) > (model.activeEntry?.screenHeight ?? 0)}
                onBackPressed={model.exit}
                onPausePressed={() => { model.isPaused = true; }}
                onResumePressed={() => { model.isPaused = false; }}
                onRestartPressed={model.restart}
            />
            <TransitionView
                transition={transition}
                thumbnail={() => model.activeEntry?.thumbnail ?? ''}
                frame={() => (model.phase === 'browsing' ? bindings.exitFrame() : undefined)}
                isPixelArt={() => model.activeEntry?.tags.kind === 'game'}
                stage={bindings.stage}
            />
        </div>
    );

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
        if (model.phase !== 'loading') launchedFrom = undefined;
    }

    /** Whether the wall is what the visitor is looking at: browsing, with no panel or transition over it. */
    function isWallActive(): boolean {
        return model.phase === 'browsing' && model.infoEntry === undefined && transition.phase === 'idle';
    }

    /**
     * While an entry plays, and until the way back has ended, the page under
     * it stays put: it keeps its place for the way back, and the polaroid and
     * the cards developing stay where the transition put them.
     */
    function lockScrollWhilePlaying(): void {
        const isPlaying = model.phase !== 'browsing' || transition.phase !== 'idle';
        if (isPlaying === isPlayingDrawn) return;
        isPlayingDrawn = isPlaying;
        document.documentElement.classList.toggle('is-playing', isPlaying);
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key !== 'Escape') return;
        if (model.infoEntry !== undefined) model.closeInfo();
        else if (model.phase === 'playing' && model.activeEntry?.tags.kind === 'game') model.isPaused = !model.isPaused;
        else if (model.phase !== 'browsing') model.exit();
        else return;
        e.preventDefault();
    }

    function activeIndex(): number {
        const active = model.activeEntry;
        return active === undefined ? -1 : entries.indexOf(active);
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
const MAX_COLUMN_COUNT = 5;
