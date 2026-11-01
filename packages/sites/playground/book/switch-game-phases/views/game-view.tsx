/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Match, Switch } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import type { GameModel } from '../models';
import { GameOverView } from './game-over-view';
import { PlayAreaView } from './play-area-view';
import { TitleView } from './title-view';
import { SCREEN_HEIGHT } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's screen: the title, the game over panel or the play area,
 * depending on the phase. All three branches are built up front, and each
 * frame the switch shows the first one whose `when` is true. A branch that
 * isn't shown is skipped, so its getters don't run.
 */
export function GameView({ model }: GameViewBindings): Container {
    // A line in the corner that names the phase, so you can see which branch it picks
    const phaseText = createComputed({
        watch: () => model.phase,
        compute: (phase) => `model.phase: '${phase}'`,
    });

    return (
        <container>
            <Switch>
                <Match when={() => model.phase === 'title'}>
                    <TitleView onStartPressed={() => model.startGame()} />
                </Match>
                <Match when={() => model.phase === 'game-over'}>
                    <GameOverView score={() => model.score} />
                </Match>
                <Match else>
                    <PlayAreaView model={model} />
                </Match>
            </Switch>
            <text text={phaseText} x={16} y={SCREEN_HEIGHT - 28} style={PHASE_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PHASE_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0x667799 };
