import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../games';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type CabinetPhase = 'menu' | 'playing';

export interface CabinetModel {
    readonly phase: CabinetPhase;
    readonly games: readonly GameEntry[];
    readonly selectedIndex: number;
    readonly activeSession: GameSession | undefined;
    selectByDelta(delta: number): void;
    launchSelected(stage: Container): Promise<void>;
    exitToMenu(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CabinetModelOptions {
    games: GameEntry[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCabinetModel(options: CabinetModelOptions): CabinetModel {
    const { games } = options;

    let phase: CabinetPhase = 'menu';
    let selectedIndex = 0;
    let activeSession: GameSession | undefined;

    const model: CabinetModel = {
        get phase() {
            return phase;
        },
        get games() {
            return games;
        },
        get selectedIndex() {
            return selectedIndex;
        },
        get activeSession() {
            return activeSession;
        },

        selectByDelta(delta: number): void {
            if (phase !== 'menu' || games.length === 0) return;
            selectedIndex = (((selectedIndex + delta) % games.length) + games.length) % games.length;
        },

        async launchSelected(stage: Container): Promise<void> {
            if (phase !== 'menu' || games.length === 0) return;
            const entry = games[selectedIndex];
            await entry.load?.();
            activeSession = entry.start(stage);
            phase = 'playing';
        },

        exitToMenu(): void {
            if (phase !== 'playing' || !activeSession) return;
            activeSession.destroy();
            activeSession = undefined;
            phase = 'menu';
        },

        update(deltaMs: number): void {
            if (phase === 'playing' && activeSession) {
                activeSession.update(deltaMs);
            }
        },
    };

    return model;
}
