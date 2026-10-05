/** @jsxImportSource @mvtjs/html */
import type { TransitionViewModel } from './transition-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TransitionViewBindings {
    /** The transition's presentation state, owned by the arcade view. */
    readonly transition: TransitionViewModel;
    /** The picture: the entry's thumbnail. */
    readonly thumbnail: () => string;
    /** The entry's last frame, shown in place of its thumbnail as the entry leaves, if there is one. */
    readonly frame: () => HTMLCanvasElement | undefined;
    /** Whether the picture is pixel art, enlarged as pixels. */
    readonly isPixelArt: () => boolean;
    /**
     * The element the entry plays in, which the runner places: this view
     * powers it on, about the play area's centre, as the entry starts.
     */
    readonly stage: HTMLElement;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The way between a card and its entry: a backdrop blacking out the page,
 * the card's polaroid (a window on the entry's picture, in a white border)
 * with a bar along its foot while the entry is still loading, and the
 * white-hot line of a tube powering on or off. As the entry starts, this
 * view squashes and brightens the stage too, as its screen powers on.
 */
export function TransitionView(bindings: TransitionViewBindings): Element {
    const { transition, stage } = bindings;
    const { picture, glow } = transition;

    // What was last written, so each frame writes only what changed
    let drawnBackdrop = NaN;
    let drawnX = NaN;
    let drawnY = NaN;
    let drawnTilt = NaN;
    let drawnScaleX = NaN;
    let drawnScaleY = NaN;
    let drawnBrightness = NaN;
    let drawnWidth = NaN;
    let drawnHeight = NaN;
    let drawnBorder = NaN;
    let drawnOpacity = NaN;
    let drawnImageX = NaN;
    let drawnImageY = NaN;
    let drawnImageWidth = NaN;
    let drawnImageHeight = NaN;
    let drawnFrame: HTMLCanvasElement | undefined;
    let drawnGlowOpacity = NaN;
    let drawnGlowWidth = NaN;
    let drawnGlowHeight = NaN;
    let isStageDrawnTransformed = false;
    let drawnStageScaleX = NaN;
    let drawnStageScaleY = NaN;
    let drawnStageBrightness = NaN;

    return (
        // The stage's step is on a wrapper that is never hidden, so it puts the stage back as the transition ends
        <div class="transition-layer" onRefresh={drawStage}>
            <div class="transition" visible={() => transition.phase !== 'idle'} aria-hidden="true">
                <div class="transition-backdrop" onRefresh={drawBackdrop} />
                <div
                    class={() => (bindings.isPixelArt() ? 'transition-picture is-pixel-art' : 'transition-picture')}
                    onRefresh={drawPicture}
                >
                    <div class="transition-image" onRefresh={drawImage}>
                        <img src={bindings.thumbnail} alt="" visible={() => !showsFrame()} />
                        <div class="transition-frame" onRefresh={drawFrame} />
                    </div>
                    <div class="transition-progress" visible={() => transition.isWaiting} onRefresh={drawProgress} />
                </div>
                <div class="transition-glow" onRefresh={drawGlow} />
            </div>
        </div>
    );

    function showsFrame(): boolean {
        return picture.showsEntryFrame && bindings.frame() !== undefined;
    }

    function drawBackdrop(backdrop: Element): void {
        if (transition.backdropOpacity === drawnBackdrop) return;
        drawnBackdrop = transition.backdropOpacity;
        (backdrop as HTMLElement).style.opacity = String(drawnBackdrop);
    }

    function drawPicture(element: Element): void {
        const style = (element as HTMLElement).style;
        if (picture.x !== drawnX || picture.y !== drawnY || picture.tilt !== drawnTilt
            || picture.scaleX !== drawnScaleX || picture.scaleY !== drawnScaleY) {
            drawnX = picture.x;
            drawnY = picture.y;
            drawnTilt = picture.tilt;
            drawnScaleX = picture.scaleX;
            drawnScaleY = picture.scaleY;
            // Tilted and squashed about its centre: the picture's transform origin
            style.transform = `translate(${drawnX}px, ${drawnY}px) rotate(${drawnTilt}deg) scale(${drawnScaleX}, ${drawnScaleY})`;
        }
        if (picture.border !== drawnBorder) {
            drawnBorder = picture.border;
            // The polaroid's white border, lying outside the window, and its shadow, as the card's lifted
            // one: spread as far as the border, so it falls from the paper, not hidden under it
            style.boxShadow = drawnBorder === 0
                ? ''
                : `0 0 0 ${drawnBorder}px ${POLAROID_WHITE}, 2px 4px 3px ${drawnBorder}px ${SHADOW_NEAR}, 8px 16px 26px ${drawnBorder}px ${SHADOW_FAR}`;
        }
        if (picture.width !== drawnWidth || picture.height !== drawnHeight) {
            drawnWidth = picture.width;
            drawnHeight = picture.height;
            style.width = `${drawnWidth}px`;
            style.height = `${drawnHeight}px`;
        }
        if (picture.opacity !== drawnOpacity) {
            drawnOpacity = picture.opacity;
            style.opacity = String(drawnOpacity);
        }
        if (picture.brightness !== drawnBrightness) {
            drawnBrightness = picture.brightness;
            style.filter = drawnBrightness === 1 ? '' : `brightness(${drawnBrightness})`;
        }
    }

    /** The whole picture, behind the window: placed relative to the window's corner. */
    function drawImage(image: Element): void {
        const style = (image as HTMLElement).style;
        const x = picture.frameX - picture.x;
        const y = picture.frameY - picture.y;
        if (x !== drawnImageX || y !== drawnImageY) {
            drawnImageX = x;
            drawnImageY = y;
            style.transform = `translate(${x}px, ${y}px)`;
        }
        if (picture.frameWidth !== drawnImageWidth || picture.frameHeight !== drawnImageHeight) {
            drawnImageWidth = picture.frameWidth;
            drawnImageHeight = picture.frameHeight;
            style.width = `${drawnImageWidth}px`;
            style.height = `${drawnImageHeight}px`;
        }
    }

    /** The tube's white-hot line, over the play area's centre, as it powers on or off. */
    function drawGlow(element: Element): void {
        const style = (element as HTMLElement).style;
        if (glow.opacity !== drawnGlowOpacity) {
            drawnGlowOpacity = glow.opacity;
            style.opacity = String(drawnGlowOpacity);
        }
        if (glow.opacity === 0 || (glow.width === drawnGlowWidth && glow.height === drawnGlowHeight)) return;
        drawnGlowWidth = glow.width;
        drawnGlowHeight = glow.height;
        const play = transition.playRect;
        style.width = `${drawnGlowWidth}px`;
        style.height = `${drawnGlowHeight}px`;
        style.transform = `translate(${play.x + (play.width - drawnGlowWidth) / 2}px, ${play.y + (play.height - drawnGlowHeight) / 2}px)`;
    }

    /** The bar's light runs along it as the wait goes on. */
    function drawProgress(bar: Element): void {
        const offset = (transition.waitedMs / PROGRESS_PERIOD_MS) % 1;
        (bar as HTMLElement).style.backgroundPositionX = `${(offset * 200).toFixed(1)}%`;
    }

    function drawFrame(holder: Element): void {
        const frame = picture.showsEntryFrame ? bindings.frame() : undefined;
        if (frame === drawnFrame) return;
        drawnFrame = frame;
        if (frame === undefined) holder.replaceChildren();
        else holder.replaceChildren(frame);
    }

    /** Squashes the stage about the play area's centre while the entry powers on, and leaves it as it was after. */
    function drawStage(): void {
        const style = stage.style;
        const powering = transition.stage;
        if (!powering.isTransformed) {
            if (!isStageDrawnTransformed) return;
            isStageDrawnTransformed = false;
            style.transform = '';
            style.transformOrigin = '';
            style.filter = '';
            return;
        }
        if (!isStageDrawnTransformed) {
            isStageDrawnTransformed = true;
            drawnStageScaleX = NaN;
            drawnStageBrightness = NaN;
            // The play area's centre, from the stage's corner
            const bounds = stage.getBoundingClientRect();
            const play = transition.playRect;
            style.transformOrigin = `${play.x + play.width / 2 - bounds.left}px ${play.y + play.height / 2 - bounds.top}px`;
        }
        if (powering.scaleX !== drawnStageScaleX || powering.scaleY !== drawnStageScaleY) {
            drawnStageScaleX = powering.scaleX;
            drawnStageScaleY = powering.scaleY;
            style.transform = `scale(${drawnStageScaleX}, ${drawnStageScaleY})`;
        }
        if (powering.brightness !== drawnStageBrightness) {
            drawnStageBrightness = powering.brightness;
            style.filter = drawnStageBrightness === 1 ? '' : `brightness(${drawnStageBrightness})`;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the waiting bar's light takes to run its length. */
const PROGRESS_PERIOD_MS = 1200;

/** The polaroid's paper, and its shadow as it lies lifted on its card. Must match `.card-polaroid` in `arcade.css`. */
const POLAROID_WHITE = '#f4f1ea';
const SHADOW_NEAR = 'rgba(0, 0, 0, 0.3)';
const SHADOW_FAR = 'rgba(0, 0, 0, 0.5)';
