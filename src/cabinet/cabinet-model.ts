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
    readonly activeSession: GameSession | null;
    selectNext(): void;
    selectPrev(): void;
    launchSelected(stage: Container): void;
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
    let activeSession: GameSession | null = null;

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

        selectNext(): void {
            if (phase !== 'menu' || games.length === 0) return;
            selectedIndex = (selectedIndex + 1) % games.length;
        },

        selectPrev(): void {
            if (phase !== 'menu' || games.length === 0) return;
            selectedIndex = (selectedIndex - 1 + games.length) % games.length;
        },

        launchSelected(stage: Container): void {
            if (phase !== 'menu' || games.length === 0) return;
            const entry = games[selectedIndex];
            activeSession = entry.start(stage);
            phase = 'playing';
        },

        exitToMenu(): void {
            if (phase !== 'playing' || activeSession === null) return;
            activeSession.destroy();
            activeSession = null;
            phase = 'menu';
        },

        update(deltaMs: number): void {
            if (phase === 'playing' && activeSession !== null) {
                activeSession.update(deltaMs);
            }
        },
    };

    return model;
}
