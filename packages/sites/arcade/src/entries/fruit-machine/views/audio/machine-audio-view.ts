import { setRefresh, setUpdate } from '@mvtjs/html';
import type { Audio80Sound } from 'audio90';
import { createMetronome, createReaction, increased } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import {
    BIG_WIN, COIN, GAME_OVER, LEVER, NO_WIN, REEL_CLICK, REEL_STOP, WAY_OF_3, WAY_OF_4, WAY_OF_5, WIN,
} from '../../data';
import type { FruitMachineModel, MachinePhase } from '../../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the machine's sound needs: the model it plays, and the chip it plays on. */
export interface MachineAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio80'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio80'>;
    /** The machine whose sound this is. */
    readonly model: FruitMachineModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the machine's sound. The lever clunks as a spin starts. The reels
 * click as they turn, and thunk as they land. A win plays a jingle, a longer
 * one for a big win, and a shower of coins. Then each winning way plays a
 * chime as it is shown. A spin that wins nothing plays a falling sigh, and a
 * slow tune plays as the credits run out.
 *
 * The view has no visuals, and is never added to the page. It is a fifth view
 * of the one model, beside the four that draw it, and the host updates and
 * refreshes it with the rest. Its presentation state is the beats of the
 * clicks and the coins, which its update step advances. The chip's own
 * sequencer keeps the jingle's place in its song.
 */
export function MachineAudioView(bindings: MachineAudioViewBindings): HTMLElement {
    const { model, music, sfx } = bindings;
    const view = document.createElement('div');
    view.className = 'machine-audio';

    // Presentation state: the clicks and coins. The chip keeps the jingle's place
    const clicks = createMetronome();
    const coins = createMetronome();

    const playLeverSoundOnEachSpin = createReaction({
        watch: () => model.spinCount,
        when: increased,
        react: () => {
            // A jingle still ringing gives way to the new spin
            music.stop();
            sfx.play(LEVER);
        },
    });
    // One thunk however many reels land in the tick, as when a stop lands them all at once
    const playStopSoundOnEachReelLanding = createReaction({
        watch: countLandingReels,
        when: increased,
        react: () => sfx.play(REEL_STOP),
    });
    const playSoundsWhenPhaseChanges = createReaction({ watch: () => model.phase, react: playPhase });
    const playWinWaySoundOnEachStep = createReaction({
        watch: () => model.celebration.stepIndex,
        when: (step) => step > 0,
        react: () => {
            const win = model.celebration.win;
            if (win !== undefined) sfx.play(chooseWay(win.rows.length));
        },
    });
    const playClickSoundOnEachReelClick = createReaction({
        watch: () => clicks.count,
        when: increased,
        react: () => sfx.play(REEL_CLICK),
    });
    const playCoinSoundOnEachCoin = createReaction({
        watch: () => coins.count,
        when: increased,
        react: () => sfx.play(COIN),
    });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        clicks.periodMs = model.phase === 'spinning' ? CLICK_MS : 0;
        clicks.update(deltaMs);
        coins.periodMs = model.celebration.stepIndex === 0 ? COIN_MS : 0;
        coins.update(deltaMs);
    }

    function refresh(): void {
        playLeverSoundOnEachSpin();
        playStopSoundOnEachReelLanding();
        playSoundsWhenPhaseChanges();
        playWinWaySoundOnEachStep();
        playClickSoundOnEachReelClick();
        playCoinSoundOnEachCoin();
    }

    function playPhase(phase: MachinePhase, previous: MachinePhase): void {
        switch (phase) {
            case 'celebrating':
                music.play(model.lastWin >= BIG_WIN_BETS * model.bet ? BIG_WIN : WIN);
                break;
            case 'idle':
                if (previous === 'spinning') sfx.play(NO_WIN);
                break;
            case 'gameOver':
                music.play(GAME_OVER);
                break;
            case 'spinning':
                break;
        }
    }

    /**
     * Counts the reels that are no longer turning at full speed. It falls to 0
     * as a spin starts, and rises as the reels reach their stops and settle.
     */
    function countLandingReels(): number {
        let count = 0;
        for (let i = 0; i < model.reels.length; i++) {
            if (model.reels[i].phase !== 'spinning') count++;
        }
        return count;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart the reels' clicks are, while they turn. */
const CLICK_MS = 70;
/** How far apart the coins are, while the opener shows off a win. */
const COIN_MS = 110;
/** A win of this many bets or more is a big one, with the longer jingle. */
const BIG_WIN_BETS = 2;

/** Chooses the chime for a winning way of `length` reels. Longer ways ring higher. */
function chooseWay(length: number): Audio80Sound {
    return length >= 5 ? WAY_OF_5 : length === 4 ? WAY_OF_4 : WAY_OF_3;
}
