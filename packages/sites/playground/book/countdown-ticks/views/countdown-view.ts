import { Container, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createComputed, createReaction } from '@mvtjs/utils';
import { createAudio80Sound, type Audio80 } from 'audio90';
import type { CountdownPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CountdownViewBindings {
    readonly secondsLeft: () => number;
    readonly phase: () => CountdownPhase;
    /** The sound chip to play the ticks and the alarm on. */
    readonly sfx: Audio80;
    /** What a click does now, shown below the seconds. */
    readonly hint: () => string;
    /** Called when the player clicks or taps anywhere on the view. */
    readonly onTapped?: () => void;
    /** The size of the area that takes clicks. Read once. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The seconds left, in big digits. Two reactions play a tick for each of
 * the last ten seconds, and an alarm when the time runs out. Each one also
 * counts how many times it has played, and shows it, so you can see when
 * it reacts, even with the sound off.
 */
export function CountdownView(bindings: CountdownViewBindings): Container {
    const { sfx, width, height } = bindings;
    const view = new Container();

    const digits = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 96, fontWeight: 'bold', fill: 0xffffff } });
    digits.anchor.set(0.5, 0.5);
    digits.position.set(width / 2, 100);
    const hint = makeText(width / 2, 180, 0x8899bb);
    const ticksText = makeText(width / 2 - 140, 240, 0xffd166);
    const alarmsText = makeText(width / 2 + 140, 240, 0xff6655);
    view.addChild(digits, hint, ticksText, alarmsText);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointertap', () => bindings.onTapped?.());

    // How many times each reaction has played its sound
    let ticksPlayed = 0;
    let alarmsPlayed = 0;

    const playTickSoundInLastTenSeconds = createReaction({
        watch: bindings.secondsLeft,
        when: (seconds, previous) => seconds < previous && seconds <= 10,
        react: () => {
            sfx.play(TICK);
            ticksPlayed += 1;
        },
    });

    const playAlarmSoundWhenTimeRunsOut = createReaction({
        watch: bindings.phase,
        when: 'done',
        react: () => {
            sfx.play(ALARM);
            alarmsPlayed += 1;
        },
    });

    // The text is made again only when what it shows changes
    const secondsText = createComputed({ watch: bindings.secondsLeft, compute: String });
    const ticksLabel = createComputed({ watch: () => ticksPlayed, compute: (count) => `ticks played: ${count}` });
    const alarmsLabel = createComputed({ watch: () => alarmsPlayed, compute: (count) => `alarms played: ${count}` });

    function refresh(): void {
        // Called on every refresh, unconditionally, so neither misses a change
        playTickSoundInLastTenSeconds();
        playAlarmSoundWhenTimeRunsOut();

        digits.text = secondsText();
        hint.text = bindings.hint();
        ticksText.text = ticksLabel();
        alarmsText.text = alarmsLabel();
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A short, dry tick. */
const TICK = createAudio80Sound({
    note: 'E-6',
    pulseWidth: 0.25,
    envelope: { attackMs: 0, decayMs: 40, sustain: 0, releaseMs: 0 },
    lengthMs: 40,
    volume: 0.5,
});

/** An alarm: two notes, taking turns. */
const ALARM = createAudio80Sound({
    note: 'A-5',
    stepMs: 90,
    envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 80 },
    volume: 0.4,
    steps: `
        # wave   pitch
        pulse    +0
        pulse    +5
        pulse    +0
        pulse    +5
        pulse    +0
        pulse    +5
    `,
});

function makeText(x: number, y: number, fill: number): Text {
    const text = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 16, fill } });
    text.anchor.set(0.5, 0.5);
    text.position.set(x, y);
    return text;
}
