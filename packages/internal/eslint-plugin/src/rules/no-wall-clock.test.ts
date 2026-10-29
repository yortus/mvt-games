import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noWallClock } from './no-wall-clock';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-wall-clock', noWallClock, {
    valid: [
        'model.update(16);',
        'const tl = gsap.timeline({ paused: true });',
        'const tween = gsap.to(target, { x: 10, duration: 1, paused: true });',
        'const d = new Date(2026, 9, 3);',
        'const t = model.now();',
        'const timer = { setTimeout: 1 };',
    ],
    invalid: [
        { code: 'setTimeout(fire, 1000);', errors: [{ messageId: 'timer' }] },
        { code: 'const id = setInterval(tick, 16);', errors: [{ messageId: 'timer' }] },
        { code: 'requestAnimationFrame(frame);', errors: [{ messageId: 'timer' }] },
        { code: 'window.setTimeout(fire, 1000);', errors: [{ messageId: 'timer' }] },
        { code: 'const started = Date.now();', errors: [{ messageId: 'clock' }] },
        { code: 'const t = performance.now();', errors: [{ messageId: 'clock' }] },
        { code: 'const today = new Date();', errors: [{ messageId: 'clock' }] },
        { code: 'gsap.to(target, { x: 10, duration: 1 });', errors: [{ messageId: 'tween' }] },
        { code: 'const tl = gsap.timeline();', errors: [{ messageId: 'tween' }] },
        { code: 'gsap.fromTo(target, { x: 0 }, { x: 10, paused: false });', errors: [{ messageId: 'tween' }] },
    ],
});
