import type { CheatSheet } from './cheat-sheet';

/** Helpers for a view's own presentation state: tweens, beats and sequences. */
export const TIME_AND_MOTION_SHEET: CheatSheet = {
    id: 'time-and-motion',
    title: 'Time and motion',
    summary: "Helpers for a view's own presentation state, such as a glow that eases in or a flash that fades. Each has an `update(deltaMs)`, which you call from the view's update step.",
    groups: [
        {
            title: 'Tweens',
            entries: [
                {
                    name: 'createBooleanTween',
                    from: '@mvtjs/utils',
                    useFor: 'Ease a number between two values as a true-or-false state changes, such as a glow that fades in while a shield is up.',
                    snippet: [
                        'const glow = createBooleanTween({',
                        '    getSource: () => model.isShielded,',
                        '    offValue: 0,',
                        '    onValue: 1,',
                        '    onDurationMs: 300,',
                        '    offDurationMs: 600,',
                        '});',
                        'setUpdate(view, glow.update);',
                        'setRefresh(view, () => {',
                        '    shield.alpha = glow.value;',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/18-growing-a-complex-view',
                },
                {
                    name: 'createEdgeTween',
                    from: '@mvtjs/utils',
                    useFor: 'Play a short tween each time a state turns true, such as a flash that fades as the player is hurt.',
                    snippet: [
                        'const flash = createEdgeTween({',
                        '    getSource: () => model.isHurt,',
                        '    triggerValue: 1,',
                        '    restValue: 0,',
                        '    durationMs: 400,',
                        '});',
                        'setUpdate(view, flash.update);',
                    ].join('\n'),
                    chapter: 'chapters/18-growing-a-complex-view',
                },
            ],
        },
        {
            title: 'Beats and sequences',
            entries: [
                {
                    name: 'createMetronome',
                    from: '@mvtjs/utils',
                    useFor: 'Count beats at a tempo you can change as you go, such as a heartbeat that quickens as fewer enemies are left.',
                    snippet: [
                        'const beat = createMetronome();',
                        'setUpdate(view, (deltaMs) => {',
                        '    beat.periodMs = 200 + 40 * model.enemiesLeft;',
                        '    beat.update(deltaMs);',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/18-growing-a-complex-view',
                },
                {
                    name: 'createRepeater',
                    from: '@mvtjs/utils',
                    useFor: 'Call a function from a model at a steady rate, such as firing while the trigger is held.',
                    snippet: [
                        'const autoFire = createRepeater({',
                        '    periodMs: () => (model.isAutoFiring ? 200 : 0),',
                        '    onRepeat: () => model.fire(),',
                        '});',
                        "// In the model's update: autoFire.update(deltaMs);",
                    ].join('\n'),
                    chapter: 'chapters/06-time-and-phases',
                },
                {
                    name: 'createSequence',
                    from: '@mvtjs/utils',
                    signature: 'createSequence(steps: readonly StepDef[]): Sequence',
                    useFor: 'Time several overlapping steps of an effect, such as a flash, a shake and a burst of dust, from one `start()`.',
                    snippet: [
                        'const celebration = createSequence([',
                        "    { name: 'flash', startMs: 0, durationMs: 100 },",
                        "    { name: 'shake', startMs: 50, durationMs: 400 },",
                        '] as const);',
                        'setUpdate(view, celebration.update);',
                        '// Later: celebration.steps.shake.progress',
                    ].join('\n'),
                    chapter: 'chapters/18-growing-a-complex-view',
                },
                {
                    name: 'createSequenceTracker',
                    from: '@mvtjs/utils',
                    signature: 'createSequenceTracker(sequence: Sequence, handlers: { [step: string]: StepHandlers }): () => void',
                    useFor: "Run code as each step of a sequence starts, while it's active, and as it ends. Call the tracker every tick.",
                    snippet: [
                        'const refreshEffects = createSequenceTracker(celebration, {',
                        '    shake: {',
                        '        active: (progress) => shakeBy(1 - progress),',
                        '        inactive: () => shakeBy(0),',
                        '    },',
                        '});',
                        'setRefresh(view, refreshEffects);',
                    ].join('\n'),
                    chapter: 'chapters/18-growing-a-complex-view',
                },
            ],
        },
    ],
};
