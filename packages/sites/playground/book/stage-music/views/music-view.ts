import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import type { GamePhase } from '../models';
import { STAGE_FANFARE, STAGE_TUNE } from './songs';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How much faster the music plays when time is running short, where 1 is the song's own tempo. */
const HURRY_TEMPO_SCALE = 1.3;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MusicViewBindings {
    /** What the view plays its music on. The view reads it once. */
    readonly music: Pick<Audio80, 'play' | 'queue' | 'stop' | 'tempoScale'>;
    readonly phase: () => GamePhase;
    readonly isHurrying: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An audio view that chooses the music. It plays the fanfare as a stage
 * starts, with the stage's tune queued straight after it, and fades the
 * music out as the game ends. The chip keeps the song's place. This view
 * only says which song plays, and how fast.
 */
export function MusicView(bindings: MusicViewBindings): Container {
    const { music } = bindings;
    const view = new Container();
    const playMusicWhenPhaseChanges = createReaction({
        watch: bindings.phase,
        react: (phase) => {
            if (phase === 'playing') {
                music.play(STAGE_FANFARE);
                music.queue(STAGE_TUNE);
            }
            else if (phase === 'game-over') {
                music.stop(undefined, { fadeMs: 1500 });
            }
        },
    });

    setRefresh(view, () => {
        playMusicWhenPhaseChanges();
        // After any new song, so the tempo suits the song that plays
        music.tempoScale = bindings.isHurrying() ? HURRY_TEMPO_SCALE : 1;
    });
    return view;
}
