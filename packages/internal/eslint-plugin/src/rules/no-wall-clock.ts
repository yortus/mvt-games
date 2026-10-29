import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * No wall-clock time: a model advances only through `update(deltaMs)`, so
 * that it can be paused, stepped, sped up and tested by its caller. Reports
 * timers (`setTimeout`, `setInterval`, `requestAnimationFrame`), clock reads
 * (`Date.now()`, `new Date()`, `performance.now()`) and GSAP tweens or
 * timelines that play on their own (made without `paused: true`). Meant for
 * model files; a config applies it to them.
 */
export const noWallClock: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow wall-clock time; advance state through `update(deltaMs)`' },
        schema: [],
        messages: {
            timer: '`{{name}}` runs on the wall clock. Advance state in `update(deltaMs)` instead.',
            clock: '`{{name}}` reads the wall clock. Advance state in `update(deltaMs)` instead.',
            tween: 'This GSAP {{name}} plays on its own. Create it with `paused: true` and advance it in `update(deltaMs)`.',
        },
    },
    create(context) {
        return {
            CallExpression: (node) => {
                const callee = node.callee;
                if (callee.type === 'Identifier' && TIMERS.has(callee.name)) {
                    context.report({ node, messageId: 'timer', data: { name: callee.name } });
                    return;
                }
                if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return;
                const object = callee.object.type === 'Identifier' ? callee.object.name : undefined;
                const property = callee.property.name;
                if (object !== undefined && GLOBALS.has(object) && TIMERS.has(property)) {
                    context.report({ node, messageId: 'timer', data: { name: property } });
                }
                else if ((object === 'Date' && property === 'now') || (object === 'performance' && property === 'now')) {
                    context.report({ node, messageId: 'clock', data: { name: `${object}.now()` } });
                }
                else if (object === 'gsap' && GSAP_TWEENS.has(property) && !isPaused(node.arguments)) {
                    context.report({ node, messageId: 'tween', data: { name: property === 'timeline' ? 'timeline' : 'tween' } });
                }
            },
            NewExpression: (node) => {
                if (node.callee.type === 'Identifier' && node.callee.name === 'Date' && node.arguments.length === 0) {
                    context.report({ node, messageId: 'clock', data: { name: 'new Date()' } });
                }
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TIMERS: ReadonlySet<string> = new Set(['setTimeout', 'setInterval', 'requestAnimationFrame', 'setImmediate']);

/** Objects a timer may be called through, as `window.setTimeout(...)`. */
const GLOBALS: ReadonlySet<string> = new Set(['window', 'globalThis', 'self']);

/** GSAP's calls that make a tween or timeline, each of which plays unless paused. */
const GSAP_TWEENS: ReadonlySet<string> = new Set(['to', 'from', 'fromTo', 'timeline']);

/** A call's arguments, as ESLint's own types describe them. */
type CallArguments = Extract<Rule.Node, { type: 'CallExpression' }>['arguments'];

/** Whether a GSAP call's last argument is an object literal with `paused: true`. */
function isPaused(args: CallArguments): boolean {
    const last = args[args.length - 1];
    if (last === undefined || last.type !== 'ObjectExpression') return false;
    for (let i = 0; i < last.properties.length; i++) {
        const property = last.properties[i];
        if (property.type !== 'Property' || property.key.type !== 'Identifier' || property.key.name !== 'paused') continue;
        return property.value.type === 'Literal' && property.value.value === true;
    }
    return false;
}
