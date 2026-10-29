import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports members of interfaces and type literals named for a control or a
 * gesture: `restartPressed`, `fireReleased`, `tileTapped`, `swipeCount`,
 * `tapCount`, `pressPlay`. A model takes what the player means, not which
 * control said it. A control held down maps onto state named for what it
 * does (`isThrusting`), and a one-off command is an action (`startNewRun()`).
 * Which control means what is decided where the input is wired. A model with
 * a field named for a control has to know what the control means, and to
 * watch for the moment it is pressed. The rule is meant for model files, and
 * a config applies it to them.
 *
 * It checks names only, so it can't catch a field with a neutral name that
 * still mirrors a control. `isHeld` is left alone, because being held is often
 * the domain's own state (a ball the player has grabbed).
 */
export const noControlNames: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow model members named for a control or gesture. Name them for what the player means.' },
        schema: [],
        messages: {
            controlName: '`{{name}}` names a control. Give the model what the player means: state named for what a held control does (`isThrusting`), or an action for a one-off command (`startNewRun()`).',
        },
    },
    create(context) {
        const check = (node: Rule.Node): void => {
            const key = (node as unknown as { key?: { type: string; name?: string } }).key;
            if (key?.type !== 'Identifier' || key.name === undefined) return;
            if (!isControlName(key.name)) return;
            context.report({ node, messageId: 'controlName', data: { name: key.name } });
        };
        // The members of interfaces and type literals: a model's interface, and the records it shares
        return {
            TSPropertySignature: check,
            TSMethodSignature: check,
        } as Rule.RuleListener;
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Names ending in what a control or gesture did, as in `restartPressed` or `cellTapped`. */
const CONTROL_EVENT = /(Pressed|Released|Tapped|Swiped|Clicked)$/;
/** Counts and directions of gestures, as in `swipeCount`, `tapCount` or `swipeDirection`. */
const GESTURE_RECORD = /^(swipe|tap|click|press)(Count|Direction)$/;
/** Actions named for pressing something, as in `pressPlay`. */
const PRESS_ACTION = /^press[A-Z]/;

function isControlName(name: string): boolean {
    return CONTROL_EVENT.test(name) || GESTURE_RECORD.test(name) || PRESS_ACTION.test(name);
}
