import { Container } from 'pixi.js';
import { HurtFlashView } from './hurt-flash-view';
import { SmoothScoreView } from './smooth-score-view';
import { StatusIconView } from './status-icon-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PlayerHudViewBindings {
    readonly score: () => number;
    readonly isHurt: () => boolean;
    readonly isBuffed: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The player's HUD: a score that counts up, a red flash as the player is
 * hurt, and an icon that bounces as a power-up starts. The three effects
 * don't depend on each other, so each is a sub-view with its own update and
 * refresh. This view only builds them. It never calls their steps, since
 * the game loop finds them wherever they sit in the tree.
 */
export function PlayerHudView(bindings: PlayerHudViewBindings): Container {
    const view = new Container();
    view.addChild(
        SmoothScoreView({ score: bindings.score }),
        HurtFlashView({ isHurt: bindings.isHurt }),
        StatusIconView({ isBuffed: bindings.isBuffed }),
    );
    return view;
}
