import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { Audio90Sound } from 'audio90';
import { createMetronome, watch } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import {
    ALL_CLEAR, ATTACK_BROKEN, BOMB, BOMB_PICKUP, BOSS_HIT, BOSS_THEME, CHARGE_TONES, EXPLODE_HUGE, EXPLODE_LARGE, EXPLODE_SMALL,
    EXTEND, FOCUS, FOCUSED_SHOT, GAME_OVER, GEM, type ItemKind, LOCK_TICK, LOCKED, POWER_UP, RESPAWN, RING_UP, SHIELD_HIT,
    SHIP_EXPLODE, SHOT, STAGE_CLEAR, STAGE_THEME, VOLLEY_BURST, VOLLEY_CHARGED, VOLLEY_LAUNCH, WARNING,
} from '../data';
import type { BossPhase, ExplosionSize, GamePhase, VolleyPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What a `GameAudioView` plays on, and the state it plays the sounds of. */
export interface GameAudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio90'>;
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
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
    /** Whether the volley's bar filled in the last step. While it does, the view sounds a tone, again and again. */
    readonly isVolleyFilling: () => boolean;
    /** How full the volley's bar is, from 0 to 1. The higher it is, the higher the tone. */
    readonly volleyCharge: () => number;
    /** Whether the volley's shots circle the ship. The view sweeps up as the ring forms. */
    readonly isVolleyRingUp: () => boolean;
    /** Bullets the volley's ring has stopped this game. The view plays a tink each time the count rises. */
    readonly volleyShieldHits: () => number;
    /** The volley's phase. The view chimes as its bar fills, ticks while it locks on, and chirps once it is locked. */
    readonly volleyPhase: () => VolleyPhase;
    /** How far the volley's lock has closed, from 0 to 1. The ticks come faster as it closes. */
    readonly volleyLockProgress: () => number;
    /** Volleys fired this game. The view plays a rush each time the count rises. */
    readonly volleysFired: () => number;
    /** Volleys that have burst this game. The view plays a crackle each time the count rises. */
    readonly volleyBursts: () => number;
    /** Where across the arena the last burst was. Bursts play there. */
    readonly volleyBurstX: () => number;
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
 * flies, explosions by their size, pickups, bombs, the volley, and the
 * ship's loss and return. While the volley's bar fills, a soft tone sounds
 * on, rising as the bar fills, and the volley chimes once it is full. Its
 * ring sweeps up as it forms around the ship, and tinks as it stops each
 * bullet. The lock ticks faster and faster as it closes, and chirps once
 * it is locked. The volley rushes out when released, and crackles as it
 * bursts. The view also plays a break as each of the boss's attacks ends,
 * and a tick while shots land on the boss. Each sound plays where it
 * happens across the arena: the ship's, the pickups' and the volley's where
 * the ship is, the volley's burst where it bursts, the boss's where the
 * boss is, and each explosion where it went off.
 *
 * The metronomes that time the guns' blips, the boss's ticks, the charging
 * tone and the lock's ticks are the view's presentation state. They advance
 * in the view's update step, so they stop while the game is paused. The
 * chip's own sequencer keeps the song's place, and it pauses with the game
 * too. The warning's repeats follow the model's warning timer instead, so
 * they stop when the game stops. The refresh step plays a sound each time a
 * count rises, the metronomes' and the model's alike.
 */
export function GameAudioView(bindings: GameAudioViewBindings): Container {
    const { music, sfx, arenaWidth } = bindings;
    const view = new Container();
    view.label = 'game-audio';

    // Presentation state: the repeating sounds. The chip keeps the song's place
    const guns = createMetronome();
    const hullTicks = createMetronome();
    const lockTicks = createMetronome();
    const chargeTones = createMetronome();

    const watcher = watch({
        phase: bindings.phase,
        extraLives: bindings.extendsEarned,
        isBombing: bindings.isBombing,
        isWarning: () => bindings.warningElapsedMs() >= 0,
        sirens: () => countSirens(bindings.warningElapsedMs()),
        bossPhase: bindings.bossPhase,
        isFocused: bindings.isFocused,
        explosions: bindings.explosionsStarted,
        items: bindings.itemsCollected,
        gems: bindings.gemsCollected,
        blips: () => guns.count,
        ticks: () => hullTicks.count,
        volleyPhase: bindings.volleyPhase,
        volleys: bindings.volleysFired,
        bursts: bindings.volleyBursts,
        lockTicks: () => lockTicks.count,
        chargeTones: () => chargeTones.count,
        isRingUp: bindings.isVolleyRingUp,
        shieldHits: bindings.volleyShieldHits,
    });
    // The watcher reads every value as it's made, so the first refresh hears the
    // guns' first blip, which the first update makes, and anything the model
    // does before it.
    // A game starts in play, so the stage's theme starts with the view
    music.play(STAGE_THEME);

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        guns.periodMs = bindings.isFiring() ? GUN_BLIP_MS : 0;
        guns.update(deltaMs);
        hullTicks.periodMs = bindings.bossMsSinceHit() < HULL_TICK_WINDOW_MS ? HULL_TICK_MS : 0;
        hullTicks.update(deltaMs);
        lockTicks.periodMs = bindings.volleyPhase() === 'locking' ? computeLockTickMs(bindings.volleyLockProgress()) : 0;
        lockTicks.update(deltaMs);
        chargeTones.periodMs = bindings.isVolleyFilling() ? CHARGE_TONE_MS : 0;
        chargeTones.update(deltaMs);
    }

    function refresh(): void {
        const w = watcher.poll();
        if (w.phase.changed) playPhase(w.phase.current, w.phase.previous);
        if (w.bossPhase.changed) playBossPhase(w.bossPhase.current);
        // The warning silences the stage's theme. The boss brings its own
        if (w.isWarning.changed && w.isWarning.current) music.stop();
        if (w.sirens.increased) sfx.play(WARNING);

        // The ship's own explosion starts as it is lost. Its loss has a sound of its own
        if (w.explosions.increased && !(w.phase.changed && w.phase.current === 'dying')) {
            sfx.play(chooseExplosion(bindings.lastExplosionSize()), { pan: toPan(bindings.lastExplosionX()) });
        }
        if (w.extraLives.increased) sfx.play(EXTEND);
        if (w.isBombing.changed && w.isBombing.current) sfx.play(BOMB);
        // The focus follows its key even after the game ends. So the sweep plays only in play, like the guns' blips
        if (w.isFocused.changed && w.isFocused.current && w.phase.current === 'playing') sfx.play(FOCUS, { pan: toPan(bindings.shipX()) });
        if (w.items.increased) sfx.play(bindings.lastItemKind() === 'power' ? POWER_UP : BOMB_PICKUP, { pan: toPan(bindings.shipX()) });
        if (w.gems.increased) sfx.play(GEM, { pan: toPan(bindings.shipX()) });

        if (w.blips.increased) sfx.play(bindings.isFocused() ? FOCUSED_SHOT : SHOT, { pan: toPan(bindings.shipX()) });
        if (w.ticks.increased) sfx.play(BOSS_HIT, { pan: toPan(bindings.bossX()) });

        if (w.chargeTones.increased && bindings.isVolleyFilling()) sfx.play(chooseChargeTone(bindings.volleyCharge()), { pan: toPan(bindings.shipX()) });
        if (w.volleyPhase.changed) playVolleyPhase(w.volleyPhase.current, w.volleyPhase.previous);
        if (w.isRingUp.changed && w.isRingUp.current) sfx.play(RING_UP, { pan: toPan(bindings.shipX()) });
        if (w.shieldHits.increased) sfx.play(SHIELD_HIT, { pan: toPan(bindings.shipX()) });
        if (w.lockTicks.increased && w.volleyPhase.current === 'locking') sfx.play(LOCK_TICK, { pan: toPan(bindings.shipX()) });
        if (w.volleys.increased) sfx.play(VOLLEY_LAUNCH, { pan: toPan(bindings.shipX()) });
        if (w.bursts.increased) sfx.play(VOLLEY_BURST, { pan: toPan(bindings.volleyBurstX()) });
    }

    function playPhase(phase: GamePhase, previous: GamePhase | undefined): void {
        switch (phase) {
            case 'playing':
                // After a lost ship, the music plays on
                if (previous === 'dying') sfx.play(RESPAWN, { pan: toPan(bindings.shipX()) });
                else music.play(STAGE_THEME);
                break;
            case 'dying':
                sfx.play(SHIP_EXPLODE, { pan: toPan(bindings.shipX()) });
                break;
            case 'tally':
                music.play(STAGE_CLEAR);
                break;
            case 'game-over':
                music.play(GAME_OVER);
                break;
            case 'all-clear':
                music.play(ALL_CLEAR);
                break;
        }
    }

    function playBossPhase(phase: BossPhase): void {
        switch (phase) {
            case 'entering':
                music.play(BOSS_THEME);
                break;
            case 'breaking':
                sfx.play(ATTACK_BROKEN, { pan: toPan(bindings.bossX()) });
                break;
            case 'exploding':
                // The last attack has ended. The music stops for the boss's explosions
                sfx.play(ATTACK_BROKEN, { pan: toPan(bindings.bossX()) });
                music.stop();
                break;
            case 'absent':
            case 'attacking':
            case 'defeated':
                break;
        }
    }

    function playVolleyPhase(phase: VolleyPhase, previous: VolleyPhase | undefined): void {
        // The bar fills only while it is charging, so a full bar is never heard twice
        if (phase === 'ready' && previous === 'charging') sfx.play(VOLLEY_CHARGED, { pan: toPan(bindings.shipX()) });
        else if (phase === 'locked') sfx.play(LOCKED, { pan: toPan(bindings.shipX()) });
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

/** The time between the charging tone's notes, in ms. Each note lasts as long, so the tone sounds on. */
const CHARGE_TONE_MS = 50;

/** Returns the charging tone's note for a bar `charge` full, from 0 to 1: the higher the charge, the higher the note. */
function chooseChargeTone(charge: number): Audio90Sound {
    const step = Math.round(Math.max(0, Math.min(1, charge)) * (CHARGE_TONES.length - 1));
    return CHARGE_TONES[step];
}

/** The time between the lock's ticks, in ms: slow as the lock sets out, and quick as it closes. */
const LOCK_TICK_SLOW_MS = 160;
const LOCK_TICK_FAST_MS = 50;

/** Returns the time between the lock's ticks when it has closed `progress` of the way, from 0 to 1. */
function computeLockTickMs(progress: number): number {
    return LOCK_TICK_SLOW_MS + (LOCK_TICK_FAST_MS - LOCK_TICK_SLOW_MS) * progress;
}

/** Returns the sound of an explosion of this size. */
function chooseExplosion(size: ExplosionSize | undefined): Audio90Sound {
    return size === 'huge' ? EXPLODE_HUGE : size === 'large' ? EXPLODE_LARGE : EXPLODE_SMALL;
}
