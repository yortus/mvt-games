import { Container, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed, createReaction, increased } from '@mvtjs/utils';
import { createAudio80Sound, type Audio80 } from 'audio90';
import type { ShipPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShotReactionsViewBindings {
    readonly phase: () => ShipPhase;
    readonly shotsFired: () => number;
    /** The sound chip to play the shots on. */
    readonly sfx: Audio80;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * How many shots the model has fired, and how many each of two reactions
 * has seen. One watches the ship's phase, and misses a shot fired while the
 * ship is still firing. The other watches the count of shots, and plays a
 * sound for each one.
 */
export function ShotReactionsView(bindings: ShotReactionsViewBindings): Container {
    const { sfx } = bindings;
    const view = new Container();

    // How many shots each reaction has seen
    let shotsSeenByPhase = 0;
    let shotsSeenByCount = 0;

    // Misses shots: the phase is already 'firing' when the second shot of a pair is fired
    const countShotWhenPhaseChangesToFiring = createReaction({
        watch: bindings.phase,
        when: 'firing',
        react: () => {
            shotsSeenByPhase += 1;
        },
    });

    // Sees every shot: each one raises the count, and two in one tick raise it by two
    const playShotSoundOnEachShot = createReaction({
        watch: bindings.shotsFired,
        when: increased,
        react: (shots, previous) => {
            for (let i = previous; i < shots; i++) sfx.play(SHOT);
            shotsSeenByCount += shots - previous;
        },
    });

    const firedText = makeRow(view, 0, 'the model', 0xffffff);
    const phaseText = makeRow(view, 70, "reaction: watch phase, when 'firing'", 0xff6655);
    const countText = makeRow(view, 140, 'reaction: watch shotsFired, when increased', 0x44ffaa);
    const firedLabel = createComputed({ watch: bindings.shotsFired, compute: (count) => `shots fired: ${count}` });
    const phaseLabel = createComputed({ watch: () => shotsSeenByPhase, compute: (count) => `shots seen: ${count}` });
    const countLabel = createComputed({ watch: () => shotsSeenByCount, compute: (count) => `shots seen: ${count}` });

    function refresh(): void {
        countShotWhenPhaseChangesToFiring();
        playShotSoundOnEachShot();
        firedText.text = firedLabel();
        phaseText.text = phaseLabel();
        countText.text = countLabel();
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A laser shot: a pulse falling an octave, its width narrowing. */
const SHOT = createAudio80Sound({
    note: 'C-6',
    stepMs: 20,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 40 },
    volume: 0.35,
    maxVoices: 2,
    steps: `
        # wave   pitch  width
        pulse    +0     p8
        pulse    -3     p6
        pulse    -6     p4
        pulse    -9     p3
        pulse    -12    p2
    `,
});

/** Adds a row's heading to the view, and returns the text below it, for its value. */
function makeRow(view: Container, y: number, heading: string, fill: number): Text {
    const headingText = new Text({ text: heading, style: { fontFamily: 'monospace', fontSize: 14, fill: 0x8899bb } });
    headingText.position.set(0, y);
    const valueText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 22, fill } });
    valueText.position.set(0, y + 22);
    view.addChild(headingText, valueText);
    return valueText;
}
