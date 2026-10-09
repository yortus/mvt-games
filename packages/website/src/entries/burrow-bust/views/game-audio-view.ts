import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMusicPlayer, type Audio80 } from '@mvtjs/audio';
import { watch } from '@mvtjs/utils';
import { DEATH, GAME_OVER, HARPOON, LEVEL_CLEAR, LEVEL_START, WALK_TUNE } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What `GameAudioView` reads about the game. */
export interface GameAudioViewBindings {
    /** The chip to play on. It is the view's output, not a query of the model, so it is read once. */
    readonly sound: Audio80;
    /** The game's phase. Each change of phase plays its tune. */
    readonly phase: () => GamePhase;
    /** Whether the digger is on its way between tiles. The walking tune moves on only while it is. */
    readonly isDiggerMoving: () => boolean;
    /** How many times the digger has shot the harpoon out. Each rise is a shot. */
    readonly harpoonShots: () => number;
    /** Whether the last creature is running for it. The walking tune hurries while it is. */
    readonly isEnemyFleeing: () => boolean;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** The walking tune's tempo while the last creature runs for it, as a multiple of its own. */
export const HURRY_TEMPO = 1.3;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's music, and the digger's harpoon. A jingle plays as each level
 * starts, and then the walking tune. The walking tune moves on only while
 * the digger moves. While the digger stands, the tune's tempo is 0, so it
 * holds where it is and its plucks die away. It hurries while the last
 * creature runs. The harpoon zips as it shoots out. Tunes play as the digger
 * is caught, as the level is cleared and as the game ends. The view draws
 * nothing.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const music = createMusicPlayer({ audio80: sound });
    const watcher = watch({ phase: bindings.phase, harpoonShots: bindings.harpoonShots });

    setUpdate(view, (deltaMs) => {
        music.tempoScale = computeTempo();
        music.update(deltaMs);
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        // The first poll sees the game start, with no phase before it, so it plays the level's jingle
        if (w.phase.changed) playPhase(w.phase.value, w.phase.previous);
        // Each rise in the count is a shot. The count's first value is not a rise
        if (w.harpoonShots.increased) sound.play(HARPOON);
        music.refresh();
    }

    /**
     * Returns the music's tempo scale. Every song but the walking tune plays at
     * its own tempo. The walking tune holds while the digger stands, and
     * hurries while the last creature runs.
     */
    function computeTempo(): number {
        if (music.song !== WALK_TUNE) return 1;
        if (!bindings.isDiggerMoving()) return 0;
        return bindings.isEnemyFleeing() ? HURRY_TEMPO : 1;
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                // Back from being caught, the walking tune starts at once. A new level or game plays its jingle first
                if (previous === 'dying') {
                    music.play(WALK_TUNE);
                }
                else {
                    music.play(LEVEL_START);
                    music.queue(WALK_TUNE);
                }
                break;
            case 'dying':
                music.play(DEATH);
                break;
            case 'level-clear':
                music.play(LEVEL_CLEAR);
                break;
            case 'game-over':
                music.play(GAME_OVER);
                break;
        }
    }
}
