/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a sound control shows, and what it reports. */
export interface SoundControlViewBindings {
    /** What the control sets the volume of, such as 'Music'. It names the slider and the icon for assistive technology, and is the icon's tooltip. */
    readonly label: string;
    /** The icon that shows for the sound, an emoji such as '🎵'. */
    readonly icon: string;
    /** The slider's id, unique in the page. The slider's hidden label refers to it. */
    readonly id: string;
    /** The volume, from 0 to 1. 0 is off. The slider shows it in tenths. */
    readonly volume: () => number;
    /** Reported with the new volume, in tenths from 0 to 1, as the slider moves. */
    readonly onVolumeChanged?: (volume: number) => void;
    /** Reported as the icon is pressed, or as Enter is pressed on the slider. */
    readonly onIconPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows one sound's volume as an icon and a slider. The slider has eleven
 * steps, from 0 (off) to 10. An arrow key moves it one step, Home turns it
 * off and End turns it all the way up. Assistive technology hears "Off", or
 * "7 of 10".
 *
 * The icon is a button, crossed out while the sound is off. The view reports
 * a press of it, and the page decides what it does. The icon is left out of
 * the tab order, so the keyboard stops once on each control. Instead, Enter
 * on the slider is reported as a press of the icon.
 */
export function SoundControlView(bindings: SoundControlViewBindings): Element {
    const { label, icon, id } = bindings;
    const name = label.toLowerCase();
    const turnOffText = `Turn the ${name} off`;
    const turnOnText = `Turn the ${name} on`;
    const toSpokenText = memoiseLast((step: number) => (step === 0 ? 'Off' : `${step} of ${STEPS}`));
    let shownStep = -1;

    return (
        <div class={() => (isOff() ? 'sound-control is-off' : 'sound-control')}>
            <button
                type="button"
                class="sound-control-toggle"
                tabIndex={-1}
                title={label}
                aria-label={() => (isOff() ? turnOnText : turnOffText)}
                onClick={() => bindings.onIconPressed?.()}
            >
                <span class="sound-control-icon" aria-hidden="true" text={icon} />
            </button>
            <label class="visually-hidden" for={id} text={label} />
            <input
                id={id}
                type="range"
                min="0"
                max={String(STEPS)}
                step="1"
                valueAsNumber={() => toStep(bindings.volume())}
                aria-valuetext={() => toSpokenText(toStep(bindings.volume()))}
                onRefresh={showFill}
                onInput={(event) => {
                    bindings.onVolumeChanged?.((event.currentTarget as HTMLInputElement).valueAsNumber / STEPS);
                }}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    // Held down, Enter repeats. One press is one toggle.
                    if (!event.repeat) bindings.onIconPressed?.();
                }}
            />
        </div>
    );

    function isOff(): boolean {
        return toStep(bindings.volume()) === 0;
    }

    /** Sets `--fill` to the thumb's place, which the stylesheet colours the track up to. */
    function showFill(slider: HTMLInputElement): void {
        const step = toStep(bindings.volume());
        if (step === shownStep) return;
        shownStep = step;
        slider.style.setProperty('--fill', FILLS[step]);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many steps the slider has above off. Each is a tenth of the volume. */
const STEPS = 10;

/** Each step's place along the slider, as a CSS percentage. */
const FILLS: readonly string[] = Array.from({ length: STEPS + 1 }, (_, step) => `${(step / STEPS) * 100}%`);

/** Converts a volume to the slider's step. A volume saved between steps shows at the nearest step. */
function toStep(volume: number): number {
    return Math.round(volume * STEPS);
}
