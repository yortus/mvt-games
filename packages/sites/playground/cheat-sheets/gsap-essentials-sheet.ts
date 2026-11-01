import type { CheatSheet } from './cheat-sheet';

/** GSAP timelines, driven by a model's `update`. */
export const GSAP_ESSENTIALS_SHEET: CheatSheet = {
    id: 'gsap-essentials',
    title: 'GSAP essentials',
    summary: "GSAP's timelines, for a model whose moves are easier to write as a sequence of tweens. Make them paused, and move them on in the model's `update`, so they keep the model's time.",
    groups: [
        {
            title: 'Timelines in a model',
            entries: [
                {
                    name: 'gsap.timeline',
                    from: 'gsap',
                    signature: 'gsap.timeline(vars?: { paused?: boolean, ... }): Timeline',
                    useFor: "Make a timeline of tweens. Make it paused, so GSAP's own clock never moves it, and move it on yourself in `update`.",
                    snippet: [
                        'const timeline = gsap.timeline({ paused: true });',
                        '',
                        'update(deltaMs) {',
                        '    timeline.time(timeline.time() + deltaMs / 1000);',
                        '},',
                    ].join('\n'),
                    chapter: 'appendices/e-timelines-with-gsap',
                },
                {
                    name: 'gsap.to',
                    from: 'gsap',
                    useFor: "Tween a state object's numbers to the values you give, over `duration` seconds. In a model, call a paused timeline's `to`, which takes the same arguments.",
                    snippet: [
                        'const state = { x: 0, y: 0 };',
                        "timeline.to(state, { x: 3, duration: 0.25, ease: 'none' });",
                    ].join('\n'),
                    chapter: 'appendices/e-timelines-with-gsap',
                },
            ],
        },
    ],
    moreAt: [
        { label: "GSAP's docs", url: 'https://gsap.com/docs/v3/' },
    ],
};
