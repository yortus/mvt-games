import { createTextureRegistry } from '@mvtjs/pixi';

// Frame names share Pixi's one asset cache with every other game's, so they
// are chosen not to clash: no bare 'ship' or 'bullet'.
export const textures = createTextureRegistry(`${import.meta.env.BASE_URL}assets/neon-monsoon-textures.json`, {
    // Keyed by `BulletKind`, so a view can look a bullet's texture up by its kind.
    bullet: {
        'pellet-red': 'pellet-red',
        'pellet-amber': 'pellet-amber',
        'pellet-orange': 'pellet-orange',
        'pellet-gold': 'pellet-gold',
        'orb-red': 'orb-red',
        'orb-amber': 'orb-amber',
        'needle-orange': 'needle-orange',
        'needle-gold': 'needle-gold',
        'rain': 'rain-drop',
    },
    // Keyed by `ShotKind`.
    shot: {
        'shot': 'shot',
        'shot-focused': 'shot-focused',
    },
    gem: 'gem',
    ship: {
        sprite: 'interceptor',
        icon: 'interceptor-icon',
    },
    bombIcon: 'bomb-icon',
    // Keyed by `EnemyKind`.
    enemy: {
        kite: 'kite',
        lancer: 'lancer',
        turret: 'turret',
        barge: 'barge',
        gunship: 'gunship',
    },
    boss: 'stormcore',
    // Keyed by `ItemKind`.
    item: {
        power: 'item-power',
        bomb: 'item-bomb',
    },
});
