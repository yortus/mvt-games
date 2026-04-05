// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface DeathFlashViewModel {
    /** Whether the flash is currently visible. */
    readonly isVisible: boolean;
    /** Current alpha (1 = fully opaque, fading to 0). */
    readonly alpha: number;
    /** Advance the flash timer by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DeathFlashViewModelBindings {
    getIsDying(): boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLASH_DURATION_MS = 200;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeathFlashViewModel(bindings: DeathFlashViewModelBindings): DeathFlashViewModel {
    let timerMs = FLASH_DURATION_MS;
    let wasDying = false;

    const viewModel: DeathFlashViewModel = {
        get isVisible() { return timerMs < FLASH_DURATION_MS; },
        get alpha() {
            if (timerMs >= FLASH_DURATION_MS) return 0;
            return 1 - timerMs / FLASH_DURATION_MS;
        },

        update(deltaMs: number): void {
            const isDying = bindings.getIsDying();
            if (isDying && !wasDying) {
                timerMs = 0;
            }
            wasDying = isDying;
            if (timerMs >= FLASH_DURATION_MS) return;
            timerMs += deltaMs;
        },
    };

    return viewModel;
}
