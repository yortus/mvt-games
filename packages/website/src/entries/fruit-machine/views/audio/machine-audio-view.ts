import { setRefresh, setUpdate } from '@mvtjs/html';
import { createMusicPlayer, type Audio80, type SoundEffect } from '@mvtjs/audio';
import { createMetronome, watch } from '@mvtjs/utils';
import {
    BIG_WIN, COIN, GAME_OVER, LEVER, NO_WIN, REEL_CLICK, REEL_STOP, WAY_OF_3, WAY_OF_4, WAY_OF_5, WIN,
} from '../../data';
import type { FruitMachineModel, MachinePhase } from '../../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the machine's sound needs: the model it plays, and the chip it plays on. */
export interface MachineAudioViewBindings {
    /** The machine whose sound this is. */
    readonly model: FruitMachineModel;
    /** The chip to play on. It is the view's output, not a query of the model, so it is read once. */
    readonly sound: Audio80;
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
 * refreshes it with the rest. Its presentation state is the jingle's place in
 * its song and the beats of the clicks and the coins. Its update step
 * advances them.
 */
export function MachineAudioView(bindings: MachineAudioViewBindings): HTMLElement {
    const { model, sound } = bindings;
    const view = document.createElement('div');
    view.className = 'machine-audio';

    // Presentation state: the jingle's place in its song, and the clicks and coins
    const music = createMusicPlayer({ audio80: sound });
    const clicks = createMetronome();
    const coins = createMetronome();

    const watcher = watch({
        phase: () => model.phase,
        spins: () => model.spinCount,
        landings: countLandingReels,
        step: () => model.celebration.stepIndex,
        clicks: () => clicks.count,
        coins: () => coins.count,
    });
    // The first refresh hears only what changes after the view is made
    watcher.poll();

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        clicks.periodMs = model.phase === 'spinning' ? CLICK_MS : 0;
        clicks.update(deltaMs);
        coins.periodMs = model.celebration.stepIndex === 0 ? COIN_MS : 0;
        coins.update(deltaMs);
        music.update(deltaMs);
    }

    function refresh(): void {
        const w = watcher.poll();
        if (w.spins.increased) {
            // A jingle still ringing gives way to the new spin
            music.stop();
            sound.play(LEVER);
        }
        // One thunk however many reels land in the tick, as when a stop lands them all at once
        if (w.landings.increased) sound.play(REEL_STOP);
        if (w.phase.changed && w.phase.previous !== undefined) playPhase(w.phase.value, w.phase.previous);
        if (w.step.changed && w.step.value > 0) {
            const win = model.celebration.win;
            if (win !== undefined) sound.play(chooseWay(win.rows.length));
        }
        if (w.clicks.increased) sound.play(REEL_CLICK);
        if (w.coins.increased) sound.play(COIN);
        music.refresh();
    }

    function playPhase(phase: MachinePhase, previous: MachinePhase): void {
        switch (phase) {
            case 'celebrating':
                music.play(model.lastWin >= BIG_WIN_BETS * model.bet ? BIG_WIN : WIN);
                break;
            case 'idle':
                if (previous === 'spinning') sound.play(NO_WIN);
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
function chooseWay(length: number): SoundEffect {
    return length >= 5 ? WAY_OF_5 : length === 4 ? WAY_OF_4 : WAY_OF_3;
}
