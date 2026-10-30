import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction, decreased } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import { CAUGHT, CLEARED, GAME_START, NIBBLE_HIGH, NIBBLE_LOW, SNEAK } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** The game's phase. The view starts the music for each phase as it changes. */
    readonly phase: () => GamePhase;
    /** How many crumbs are left in the maze. Each fall is a crumb eaten. */
    readonly remainingCrumbs: () => number;
    /** How many crumbs a full maze has. The game has one maze, so the view reads it once. */
    readonly totalCrumbs: number;
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/**
 * How much faster the sneaking tune plays with the maze empty than full, as a
 * share of its own tempo. The tune speeds up in step with the crumbs eaten.
 */
export const SNEAK_SPEED_UP = 0.6;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's music and its nibbles. As a game starts, it plays a short
 * tune and then the sneaking tune, which speeds up as the maze empties. It
 * plays a nibble for each crumb eaten. The nibbles go low and high by turns,
 * by whether the crumbs left are odd or even, so the view keeps no count of
 * its own. It plays a falling tune when the mouse is caught, and a bright one
 * when the maze is cleared. Which tune plays, and how fast, is the view's
 * presentation state. The chip's own sequencer keeps the tune's place, and it
 * pauses with the game.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { music, sfx, totalCrumbs } = bindings;
    const view = new Container();
    view.label = 'game-audio';
    const playSoundsWhenPhaseChanges = createReaction({ watch: bindings.phase, react: (phase) => playPhase(phase) });
    // A fall is a crumb eaten. The rise as a new game starts is not a fall
    const playNibbleSoundOnEachCrumbEaten = createReaction({
        watch: bindings.remainingCrumbs,
        when: decreased,
        react: (crumbs) => sfx.play(crumbs % 2 === 0 ? NIBBLE_LOW : NIBBLE_HIGH),
    });
    // The view is made as the game starts, so it opens with the start's tune
    playPhase(bindings.phase());
    music.tempoScale = computeTempoScale();

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        playSoundsWhenPhaseChanges();
        playNibbleSoundOnEachCrumbEaten();
        // After any new song, so the tempo is the one for the song that plays. It is sent ahead of the song
        music.tempoScale = computeTempoScale();
    }

    function playPhase(phase: GamePhase): void {
        // A game can end during the start's tune. Playing the end's tune cancels the sneaking tune queued
        switch (phase) {
            case 'playing':
                music.play(GAME_START);
                music.queue(SNEAK);
                break;
            case 'game-over':
                music.play(CAUGHT);
                break;
            case 'won':
                music.play(CLEARED);
                break;
        }
    }

    /** Returns the sneaking tune's tempo for the crumbs left, or 1 for every other song. */
    function computeTempoScale(): number {
        if (music.song !== SNEAK) return 1;
        return 1 + (1 - bindings.remainingCrumbs() / totalCrumbs) * SNEAK_SPEED_UP;
    }
}
