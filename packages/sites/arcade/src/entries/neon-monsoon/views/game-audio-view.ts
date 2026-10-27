import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { Audio90, Audio90Sound } from 'audio90';
import { createMetronome, watch } from '@mvtjs/utils';
import {
    ALL_CLEAR, ATTACK_BROKEN, BOMB, BOMB_PICKUP, BOSS_HIT, BOSS_THEME, EXPLODE_HUGE, EXPLODE_LARGE, EXPLODE_SMALL,
    EXTEND, FOCUS, FOCUSED_SHOT, GAME_OVER, GEM, GRAZE, type ItemKind, POWER_UP, RESPAWN, SHIP_EXPLODE, SHOT, STAGE_CLEAR,
    STAGE_THEME, WARNING,
} from '../data';
import type { BossPhase, ExplosionSize, GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip to play on. It is the view's output, not model state, so the view reads it once. */
    readonly sound: Audio90;
    /** The game's phase. The view starts the music for each phase, and plays the ship's loss and return. */
    readonly phase: () => GamePhase;
    /** Extra lives earned this game. The view plays a chime each time the count rises. */
    readonly extendsEarned: () => number;
    /** Whether a bomb is going off. The view plays the bomb as it starts. */
    readonly isBombing: () => boolean;
    /**
     * How long the boss's warning has been showing, in ms, or -1 while it is
     * not. The view stops the music as the warning starts, and sounds the
     * warning again at a steady pace while it shows.
     */
    readonly warningElapsedMs: () => number;
    /** The boss's phase. The view plays the boss's theme as it enters, and a break as each attack ends. */
    readonly bossPhase: () => BossPhase;
    /** How long since the boss last took damage, in ms, or Infinity if it never has. */
    readonly bossMsSinceHit: () => number;
    /** Whether the guns' blips should sound. The ship's guns fire on their own while it flies. */
    readonly isFiring: () => boolean;
    /** Whether the ship is focused, flying slowly and firing a narrow column. */
    readonly isFocused: () => boolean;
    /** Bullets grazed this game. The view plays a bell each time the count rises. */
    readonly grazes: () => number;
    /** Explosions started this game. The view plays an explosion each time the count rises. */
    readonly explosionsStarted: () => number;
    /** The size of the explosion started last. It chooses which explosion the view plays. */
    readonly lastExplosionSize: () => ExplosionSize | undefined;
    /** Items picked up this game. The view plays a pickup each time the count rises. */
    readonly itemsCollected: () => number;
    /** The kind of item picked up last. It chooses which pickup the view plays. */
    readonly lastItemKind: () => ItemKind | undefined;
    /** Gems picked up this game. The view plays a sparkle each time the count rises. */
    readonly gemsCollected: () => number;
    /** Where across the arena the ship is, from 0 to `arenaWidth`. The ship's sounds, and the pickups', play there. */
    readonly shipX: () => number;
    /** Where across the arena the boss is. Its ticks and its broken attacks play there. */
    readonly bossX: () => number;
    /** Where across the arena the explosion started last is. Explosions play there. */
    readonly lastExplosionX: () => number;
    /** How wide the arena is, which the places across it are measured in. Read once. */
    readonly arenaWidth: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the game's music and sounds, on the Audio90. The stage has its own theme. A warning
 * silences it and sounds again and again while it shows. Then the boss
 * brings a faster theme. A jingle plays over each stage's tally, a finale
 * plays when every loop is cleared, and a slow tune plays when the game is
 * over. Over the music, the view plays the guns' soft blips while the ship
 * flies, a bell for each graze, explosions by their size, pickups, bombs,
 * and the ship's loss and return. It also plays a break as each of the
 * boss's attacks ends, and a tick while shots land on the boss. Each sound
 * plays where it happens across the arena: the ship's, the pickups' and the
 * grazes' where the ship is, the boss's where the boss is, and each
 * explosion where it went off.
 *
 * The metronomes that time the guns' blips and the boss's ticks are the
 * view's presentation state. They advance in the view's update step, so they
 * stop while the game is paused. The chip's own sequencer keeps the song's
 * place, and it pauses with the game too. The warning's repeats follow the
 * model's warning timer instead, so they stop when the game stops. The
 * refresh step plays a sound each time a count rises, the metronomes' and the
 * model's alike.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { sound, arenaWidth } = bindings;
    const view = new Container();
    view.label = 'game-audio';

    // Presentation state: the repeating sounds. The chip keeps the song's place
    // The play of the song playing, which `stop` takes, so stopping the music leaves the sounds playing
    let musicId = 0;
    const guns = createMetronome();
    const hullTicks = createMetronome();

    const watcher = watch({
        phase: bindings.phase,
        extraLives: bindings.extendsEarned,
        isBombing: bindings.isBombing,
        isWarning: () => bindings.warningElapsedMs() >= 0,
        sirens: () => countSirens(bindings.warningElapsedMs()),
        bossPhase: bindings.bossPhase,
        isFocused: bindings.isFocused,
        grazes: bindings.grazes,
        explosions: bindings.explosionsStarted,
        items: bindings.itemsCollected,
        gems: bindings.gemsCollected,
        blips: () => guns.count,
        ticks: () => hullTicks.count,
    });
    // The first poll sees every value as new, not as a change. Polling here
    // makes the first refresh hear the guns' first blip, which the first
    // update makes, and anything the model does before it.
    watcher.poll();
    // A game starts in play, so the stage's theme starts with the view
    musicId = sound.play(STAGE_THEME);

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        guns.periodMs = bindings.isFiring() ? GUN_BLIP_MS : 0;
        guns.update(deltaMs);
        hullTicks.periodMs = bindings.bossMsSinceHit() < HULL_TICK_WINDOW_MS ? HULL_TICK_MS : 0;
        hullTicks.update(deltaMs);
    }

    function refresh(): void {
        const w = watcher.poll();
        if (w.phase.changed) playPhase(w.phase.value, w.phase.previous);
        if (w.bossPhase.changed) playBossPhase(w.bossPhase.value);
        // The warning silences the stage's theme. The boss brings its own
        if (w.isWarning.changed && w.isWarning.value) sound.stop(musicId);
        if (w.sirens.increased) sound.play(WARNING);

        // The ship's own explosion starts as it is lost. Its loss has a sound of its own
        if (w.explosions.increased && !(w.phase.changed && w.phase.value === 'dying')) {
            sound.play(chooseExplosion(bindings.lastExplosionSize()), { pan: toPan(bindings.lastExplosionX()) });
        }
        if (w.extraLives.increased) sound.play(EXTEND);
        if (w.isBombing.changed && w.isBombing.value) sound.play(BOMB);
        // The focus follows its key even after the game ends. So the sweep plays only in play, like the guns' blips
        if (w.isFocused.changed && w.isFocused.value && w.phase.value === 'playing') sound.play(FOCUS, { pan: toPan(bindings.shipX()) });
        if (w.items.increased) sound.play(bindings.lastItemKind() === 'power' ? POWER_UP : BOMB_PICKUP, { pan: toPan(bindings.shipX()) });
        if (w.gems.increased) sound.play(GEM, { pan: toPan(bindings.shipX()) });
        if (w.grazes.increased) sound.play(GRAZE, { pan: toPan(bindings.shipX()) });

        if (w.blips.increased) sound.play(bindings.isFocused() ? FOCUSED_SHOT : SHOT, { pan: toPan(bindings.shipX()) });
        if (w.ticks.increased) sound.play(BOSS_HIT, { pan: toPan(bindings.bossX()) });
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                // After a lost ship, the music plays on
                if (previous === 'dying') sound.play(RESPAWN, { pan: toPan(bindings.shipX()) });
                else musicId = sound.play(STAGE_THEME);
                break;
            case 'dying':
                sound.play(SHIP_EXPLODE, { pan: toPan(bindings.shipX()) });
                break;
            case 'tally':
                musicId = sound.play(STAGE_CLEAR);
                break;
            case 'game-over':
                musicId = sound.play(GAME_OVER);
                break;
            case 'all-clear':
                musicId = sound.play(ALL_CLEAR);
                break;
        }
    }

    function playBossPhase(phase: BossPhase): void {
        switch (phase) {
            case 'entering':
                musicId = sound.play(BOSS_THEME);
                break;
            case 'breaking':
                sound.play(ATTACK_BROKEN, { pan: toPan(bindings.bossX()) });
                break;
            case 'exploding':
                // The last attack has ended. The music stops for the boss's explosions
                sound.play(ATTACK_BROKEN, { pan: toPan(bindings.bossX()) });
                sound.stop(musicId);
                break;
            case 'absent':
            case 'attacking':
            case 'defeated':
                break;
        }
    }

    /** The pan of a place `x` across the arena: the edges a little short of hard left and right, so no sound leaves one ear alone. */
    function toPan(x: number): number {
        return Math.max(-1, Math.min(1, (x / arenaWidth) * 2 - 1)) * PAN_SPREAD;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The time between the guns' blips while they fire, in ms. It is twice the
 * time between the guns' volleys, so the blips patter rather than buzz.
 */
const GUN_BLIP_MS = 140;
/** How far towards either side a sound at the arena's edge is panned, from 0 (the middle) to 1. */
const PAN_SPREAD = 0.8;
/** The time between the warning's sounds while it shows, in ms. */
const SIREN_MS = 750;
/** The time between the boss's ticks while shots land on it, in ms. */
const HULL_TICK_MS = 90;
/** The boss's ticks go on for this long after the last hit, in ms. */
const HULL_TICK_WINDOW_MS = 100;

/**
 * Returns how many times the warning has sounded so far: one as it starts,
 * then one more every `SIREN_MS`. It returns 0 while the warning is not
 * showing.
 */
function countSirens(warningElapsedMs: number): number {
    return warningElapsedMs < 0 ? 0 : Math.floor(warningElapsedMs / SIREN_MS) + 1;
}

/** Returns the sound of an explosion of this size. */
function chooseExplosion(size: ExplosionSize | undefined): Audio90Sound {
    return size === 'huge' ? EXPLODE_HUGE : size === 'large' ? EXPLODE_LARGE : EXPLODE_SMALL;
}
