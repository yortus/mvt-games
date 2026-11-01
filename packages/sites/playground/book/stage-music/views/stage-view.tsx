/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { Audio80 } from 'audio90';
import type { StageModel } from '../models';
import { BeatPulseView } from './beat-pulse-view';
import { MusicView } from './music-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StageViewBindings {
    readonly model: StageModel;
    /** What the game's music plays on, read once. */
    readonly music: Pick<Audio80, 'play' | 'queue' | 'stop' | 'tempoScale' | 'beat'>;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's title, the time left in a stage, or the end of the game, with
 * a ring that pulses with the music, and the audio view that chooses it.
 * Click to start a stage.
 */
export function StageView({ model, music, width, height }: StageViewBindings): Container {
    // The seconds left, made into text only when the whole number changes
    const secondsLeft = createComputed({ watch: () => Math.ceil(model.timeLeftMs / 1000), compute: String });

    return (
        <container hitArea={new Rectangle(0, 0, width, height)} cursor="pointer" onPointerDown={model.startStage}>
            <container visible={() => model.phase !== 'title'}>
                <BeatPulseView beat={() => music.beat} x={width / 2} y={150} />
            </container>
            <container visible={() => model.phase === 'title'}>
                <text text="Click to start a stage" x={width / 2} y={150} anchor={0.5} style={MESSAGE_STYLE} />
                <text text="A stage lasts 12 seconds. The music hurries in the last 4." x={width / 2} y={300} anchor={0.5} style={HINT_STYLE} />
            </container>
            <text
                text={secondsLeft}
                x={width / 2}
                y={150}
                anchor={0.5}
                visible={() => model.phase === 'playing'}
                tint={() => (model.isHurrying ? 0xff6b5e : 0xffffff)}
                style={COUNT_STYLE}
            />
            <text text="Time's up!" x={width / 2} y={150} anchor={0.5} visible={() => model.phase === 'game-over'} style={MESSAGE_STYLE} />
            <MusicView music={music} phase={() => model.phase} isHurrying={() => model.isHurrying} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MESSAGE_STYLE = { fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: 0xe6edf3 };
const COUNT_STYLE = { fontFamily: 'monospace', fontSize: 72, fontWeight: 'bold', fill: 0xffffff };
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
