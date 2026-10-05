import type { Container } from 'pixi.js';
import { assert } from '@mvtjs/utils';
import type { ArcadeEntry, EntrySession, PixiEntryStarter } from '../entries';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type CabinetPhase = 'menu' | 'playing';

export interface CabinetModel {
    readonly phase: CabinetPhase;
    readonly games: readonly ArcadeEntry[];
    readonly selectedIndex: number;
    /** The selected game, loaded: set once it launches. */
    readonly activeStarter: PixiEntryStarter | undefined;
    readonly activeSession: EntrySession | undefined;
    selectByDelta: (delta: number) => void;
    launchSelected: (stage: Container) => Promise<void>;
    restartSession: (stage: Container) => void;
    exitToMenu: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CabinetModelOptions {
    /** The games, each drawn with Pixi. */
    games: readonly ArcadeEntry[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCabinetModel(options: CabinetModelOptions): CabinetModel {
    const { games } = options;

    let phase: CabinetPhase = 'menu';
    let selectedIndex = 0;
    let activeStarter: PixiEntryStarter | undefined;
    let activeSession: EntrySession | undefined;

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
        get activeStarter() {
            return activeStarter;
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
            const starter = await entry.load();
            assert(starter.kind === 'pixi', () => `cabinet: ${entry.id} is not drawn with Pixi`);
            activeStarter = starter;
            activeSession = starter.start({ stage });
            phase = 'playing';
        },

        restartSession(stage: Container): void {
            if (phase !== 'playing' || !activeSession || !activeStarter) return;
            activeSession.destroy();
            activeSession = activeStarter.start({ stage });
        },

        exitToMenu(): void {
            if (phase !== 'playing' || !activeSession) return;
            activeSession.destroy();
            activeSession = undefined;
            activeStarter = undefined;
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
