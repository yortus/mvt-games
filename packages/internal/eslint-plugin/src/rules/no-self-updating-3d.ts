import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports a PixiJS 3D feature left to move on Pixi's shared ticker. A 3D
 * model's animation, a particle system, the orbit and first-person cameras
 * and a live texture can each update themselves every frame, by wall-clock
 * time. In a view, that's an autonomous animation, which MVT rules out. It
 * keeps moving while the game is paused, and a visual test can't hold it
 * still. So the rule reports these cases:
 *
 * - `new Model3D`, `Model3D.from`, `View3D.from`, `new AnimationPlayer`,
 *   `new ParticleSystem3D`, `new OrbitCamera` and `new FPSCamera` update
 *   themselves unless they're made with `autoUpdate: false` written in their
 *   options.
 * - `new ContainerTexture` and `new ContainerSource` update themselves only
 *   with `autoUpdate` on, so the rule reports any `autoUpdate` but `false`.
 * - Setting `autoUpdate` to anything but `false` is reported too, on any
 *   object, since Pixi's own `AnimatedSprite` and video sources move on the
 *   shared ticker in the same way.
 *
 * Drive the feature from your view's `deltaMs` instead. The `<model>`
 * element's `clip` and `clipTimeMs` attributes, and `ParticlesView`, from
 * `@mvtjs/pixi-3d`, do this for you.
 */
export const noSelfUpdating3d: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow PixiJS 3D features that move on Pixi\'s shared ticker, by wall-clock time' },
        schema: [],
        messages: {
            defaultsOn: '`{{name}}` updates itself on Pixi\'s shared ticker unless its options include `autoUpdate: false`. '
                + 'Add that, and drive it from your view\'s `deltaMs` instead, as `<model clip clipTimeMs>` and '
                + '`ParticlesView` do.',
            turnedOn: 'With `autoUpdate` on, this updates itself on Pixi\'s shared ticker, by wall-clock time. Leave it off, '
                + 'and move it from your view instead. Draw a live texture in a refresh step, as `ScreenView` does, and '
                + 'advance anything that moves in an update step, from its `deltaMs`.',
        },
    },
    create(context) {
        return {
            NewExpression: (node) => {
                const name = calleeName(node.callee);
                if (name === undefined) return;
                if (ON_BY_DEFAULT.has(name)) {
                    if (!isAutoUpdateOff(node.arguments[0])) context.report({ node, messageId: 'defaultsOn', data: { name } });
                }
                else if (OFF_BY_DEFAULT.has(name)) {
                    const value = findAutoUpdate(node.arguments[0]);
                    if (value !== undefined && !isLiteralFalse(value)) context.report({ node: value, messageId: 'turnedOn' });
                }
            },
            CallExpression: (node) => {
                const callee = node.callee;
                if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier' || callee.property.name !== 'from') return;
                const owner = calleeName(callee.object as Callee);
                if (owner !== 'Model3D' && owner !== 'View3D') return;
                if (!isAutoUpdateOff(node.arguments[1])) context.report({ node, messageId: 'defaultsOn', data: { name: `${owner}.from` } });
            },
            AssignmentExpression: (node) => {
                const target = node.left;
                if (target.type !== 'MemberExpression' || target.property.type !== 'Identifier' || target.property.name !== 'autoUpdate') return;
                if (!isLiteralFalse(node.right)) context.report({ node, messageId: 'turnedOn' });
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** ESTree's node types, as ESLint's visitors receive them. */
type NewExpressionNode = Parameters<NonNullable<Rule.RuleListener['NewExpression']>>[0];
type Callee = NewExpressionNode['callee'];
type Argument = NewExpressionNode['arguments'][number];
type Expression = Exclude<Argument, { type: 'SpreadElement' }>;
type SpreadElement = Extract<Argument, { type: 'SpreadElement' }>;
type ObjectExpression = Extract<Expression, { type: 'ObjectExpression' }>;

/** Classes that update themselves unless their options turn `autoUpdate` off. */
const ON_BY_DEFAULT: ReadonlySet<string> = new Set(['Model3D', 'AnimationPlayer', 'ParticleSystem3D', 'OrbitCamera', 'FPSCamera']);

/** Classes that update themselves only when `autoUpdate` is turned on. */
const OFF_BY_DEFAULT: ReadonlySet<string> = new Set(['ContainerTexture', 'ContainerSource']);

function calleeName(callee: Callee): string | undefined {
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;
    return undefined;
}

/** Finds the `autoUpdate` written in an options object literal, if there is one. */
function findAutoUpdate(options: Expression | SpreadElement | undefined): Expression | undefined {
    if (options?.type !== 'ObjectExpression') return undefined;
    return findProperty(options, 'autoUpdate');
}

function findProperty(options: ObjectExpression, name: string): Expression | undefined {
    for (const property of options.properties) {
        if (property.type !== 'Property' || property.computed) continue;
        const key = property.key;
        const keyName = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? String(key.value) : undefined;
        if (keyName === name) return property.value as Expression;
    }
    return undefined;
}

function isAutoUpdateOff(options: Expression | SpreadElement | undefined): boolean {
    const value = findAutoUpdate(options);
    return value !== undefined && isLiteralFalse(value);
}

function isLiteralFalse(node: { readonly type: string }): boolean {
    return node.type === 'Literal' && (node as { readonly value?: unknown }).value === false;
}
