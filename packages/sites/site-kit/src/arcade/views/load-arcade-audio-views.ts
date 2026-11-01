import type { ArcadeAudioViewBindings } from './arcade-audio-view';
import type { VolumePreviewAudioViewBindings } from './volume-preview-audio-view';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The views that play the Arcade's own sounds on the page's chip. */
export interface ArcadeAudioViews {
    /** Plays the Arcade's sounds, for the wall, the way into and out of an entry, pausing and failures. */
    readonly ArcadeAudioView: (bindings: ArcadeAudioViewBindings) => HTMLElement;
    /** Plays the pause menu's previews of the volumes. */
    readonly VolumePreviewAudioView: (bindings: VolumePreviewAudioViewBindings) => HTMLElement;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Loads the Arcade's audio views, and returns them. They load separately from
 * the page, with the Arcade's sounds and the code that plays them, so the
 * page's first load holds none of it. That is also why the views' barrel does
 * not export them.
 */
export async function loadArcadeAudioViews(): Promise<ArcadeAudioViews> {
    const [{ ArcadeAudioView }, { VolumePreviewAudioView }] = await Promise.all([
        import('./arcade-audio-view'),
        import('./volume-preview-audio-view'),
    ]);
    return { ArcadeAudioView, VolumePreviewAudioView };
}
