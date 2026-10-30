import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createMetronome, createReaction, increased } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import {
    BAA,
    BLOW_OUT,
    CREAK,
    EXTRA_LIFE,
    FARM_FENCED_TUNE,
    GAME_OVER_TUNE,
    HATCH,
    MEADOW_TUNE,
    ROUND_CLEAR_TUNE,
    ROUND_START,
    SNAP,
    SNAPPED_TUNE,
    STRING_TICK,
    TIE_OFF,
} from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What `GameAudioView` reads about the game. */
export interface GameAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** The game's phase. Each change of phase plays its tune. */
    readonly phase: () => GamePhase;
    /** Steps of wire strung. Each rise ticks. */
    readonly wireSteps: () => number;
    /** Wires tied off. Each rise is a hammer and a run up. */
    readonly closures: () => number;
    /** Sheep penned. Each rise bleats. */
    readonly sheepPenned: () => number;
    /** Dust devils blown out. Each rise is a rush of wind. */
    readonly devilsBlownOut: () => number;
    /** Beetles hatched. Each rise cracks a shell. */
    readonly beetlesHatched: () => number;
    /** Extra lives earned. Each rise plays a run up to a high G. */
    readonly extraLivesEarned: () => number;
    /** Whether slack is running along the wire. It creaks while it does. */
    readonly isSlackRunning: () => boolean;
    /** The share of the meadow fenced off, and the round's target. The tune quickens as the share nears the target. */
    readonly share: () => number;
    readonly targetShare: () => number;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** How much faster the meadow tune plays with the round's target reached, as a multiple of its own tempo. */
export const FULL_FIELD_TEMPO = 1.25;

/** How often the slack creaks while it runs. */
export const CREAK_PERIOD_MS = 240;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's music and sounds. A banjo roll plays as each round starts,
 * then the meadow tune, which quickens as more of the meadow is fenced off.
 * Each step of wire ticks off the reel, slack creaks as it runs, and a
 * wire tied off rings out. Penned sheep bleat, dust devils rush away as
 * they blow out, and beetles crack out of their eggs. An extra life earned
 * runs up to a high G. A snapped wire
 * twangs, and tunes play as the round is cleared, as the whole farm is
 * fenced, and as the game ends. The view draws nothing.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { music, sfx } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const creaks = createMetronome();
    const playSoundsWhenPhaseChanges = createReaction({ watch: bindings.phase, react: (phase) => playPhase(phase) });
    // Each count plays its own sound as it rises, the sound at its index in `sounds`
    const counts = [
        { count: bindings.wireSteps, sound: STRING_TICK },
        { count: bindings.closures, sound: TIE_OFF },
        { count: bindings.sheepPenned, sound: BAA },
        { count: bindings.devilsBlownOut, sound: BLOW_OUT },
        { count: bindings.beetlesHatched, sound: HATCH },
        { count: bindings.extraLivesEarned, sound: EXTRA_LIFE },
        { count: () => creaks.count, sound: CREAK },
    ];
    const playEachCountsSoundWhenItRises = createReaction({
        watch: counts.map((entry) => entry.count),
        when: increased,
        react: (_count, _previous, index) => sfx.play(counts[index].sound),
    });
    // The view is made as the game starts, with no phase before it, so it plays the round's jingle now
    playPhase(bindings.phase());
    music.tempoScale = computeTempo();

    setUpdate(view, (deltaMs) => {
        creaks.periodMs = bindings.phase() === 'playing' && bindings.isSlackRunning() ? CREAK_PERIOD_MS : 0;
        creaks.update(deltaMs);
    });
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        playSoundsWhenPhaseChanges();
        playEachCountsSoundWhenItRises();
        // After any new song, so the tempo is the one for the song that plays. It is sent ahead of the song
        music.tempoScale = computeTempo();
    }

    /** The meadow tune quickens as the share fenced off nears the round's target. Every other song plays at its own tempo. */
    function computeTempo(): number {
        if (music.song !== MEADOW_TUNE) return 1;
        const progress = Math.min(1, bindings.share() / bindings.targetShare());
        return 1 + (FULL_FIELD_TEMPO - 1) * progress;
    }

    function playPhase(phase: GamePhase): void {
        switch (phase) {
            case 'ready':
                music.play(ROUND_START);
                break;
            case 'playing':
                music.play(MEADOW_TUNE);
                break;
            case 'snapped':
                sfx.play(SNAP);
                music.play(SNAPPED_TUNE);
                break;
            case 'round-clear':
                music.play(ROUND_CLEAR_TUNE);
                break;
            case 'farm-fenced':
                music.play(FARM_FENCED_TUNE);
                break;
            case 'game-over':
                music.play(GAME_OVER_TUNE);
                break;
        }
    }
}
