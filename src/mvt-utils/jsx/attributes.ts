// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How a changeable attribute's getter is written each frame:
 *
 * - `'every-frame'`: the getter's result is written every frame. For cheap
 *   writes, such as a number assigned to a property.
 * - `'on-change'`: written when it differs (`!==`) from the value last
 *   written. For writes that cost something even when the value is the same,
 *   such as a texture or a string of text.
 * - `'on-change-number'`: as `'on-change'`, for numbers that may be
 *   fractional. The last value is kept in a `Float64Array` rather than a
 *   closure variable, where V8 would box a fractional number on every write.
 */
export type WriteKind = 'every-frame' | 'on-change' | 'on-change-number';

/** An attribute that takes only a fixed value, applied once, at construction. */
export interface FixedAttribute<E, T> {
    readonly kind: 'fixed';
    /** Writes `value` to `el`. */
    readonly apply: (el: E, value: T) => void;
    /** The property `apply` assigns, when the attribute was defined by one. */
    readonly property?: string;
}

/**
 * An attribute that takes a fixed value or a getter. A fixed value is applied
 * at construction; a getter is bound, and written from the element's refresh
 * as its {@link WriteKind} says.
 */
export interface ChangeableAttribute<E, T> {
    readonly kind: WriteKind;
    /** Writes `value` to `el`. */
    readonly apply: (el: E, value: T) => void;
    /**
     * The property `apply` assigns, when the attribute was defined by one.
     * Generated refresh methods then assign it inline rather than calling
     * `apply`; see {@link attributesOf}.
     */
    readonly property?: string;
}

/** An attribute that takes an event handler, added with the JSX target's `listen`. */
export interface EventAttribute<Ev> {
    readonly kind: 'event';
    /** The event's name, as the JSX target's `listen` expects it. */
    readonly eventName: string;
    /** Never set: carries the handler's type, for `IntrinsicElementsOf`. */
    readonly handler?: (event: Ev) => void;
}

/** Any attribute definition that an element of type `E` accepts. */
export type AttributeDefinition<E> = FixedAttribute<E, never> | ChangeableAttribute<E, never> | EventAttribute<never>;

/**
 * Makes the definition of an attribute whose name starts with a pattern's
 * prefix (HTML's `data-`), given the attribute's full name.
 */
export type AttributePattern<E> = (name: string) => FixedAttribute<E, never> | ChangeableAttribute<E, never>;

/** An element's attribute patterns, by prefix: none, for most elements. */
export type NoPatterns = Readonly<Record<never, never>>;

/**
 * An intrinsic element: how to create it, the attributes it accepts, and the
 * patterns of any whose names are not known in advance.
 */
export interface ElementDefinition<E, A, P = NoPatterns> {
    readonly create: () => E;
    readonly attributes: A;
    /**
     * Attributes whose names are not known in advance, such as HTML's
     * `data-*`, by prefix. The first time an element of this kind is given an
     * attribute with one of these prefixes that `attributes` lacks, the
     * pattern makes its definition, which is then kept for that name. It is
     * written like any other: its name never reaches generated code.
     */
    readonly patterns: P;
}

/**
 * Helpers that define the attributes of elements of type `E`. Each takes the
 * name of a property of `E`, which the attribute assigns, or an `apply`
 * function, for any other write (`(e, v: number) => { e.scale.set(v); }`).
 * Changeable ones also say how a getter is written: see {@link WriteKind}.
 */
export interface AttributeHelpers<E> {
    /** An attribute that takes only a fixed value, written once, at construction. */
    readonly fixed: {
        <K extends keyof E & string>(property: K): FixedAttribute<E, E[K]>;
        <T>(apply: (el: E, value: T) => void): FixedAttribute<E, T>;
    };
    /** A changeable attribute whose getter is written every frame. */
    readonly everyFrame: {
        <K extends keyof E & string>(property: K): ChangeableAttribute<E, E[K]>;
        <T>(apply: (el: E, value: T) => void): ChangeableAttribute<E, T>;
    };
    /** A changeable attribute whose getter is written when its result changes. */
    readonly onChange: {
        <K extends keyof E & string>(property: K): ChangeableAttribute<E, E[K]>;
        <T>(apply: (el: E, value: T) => void): ChangeableAttribute<E, T>;
    };
    /**
     * A changeable number attribute whose getter is written when its result
     * changes, kept without boxing. For numbers that may be fractional.
     */
    readonly onChangeNumber: {
        (property: NumberPropertyOf<E>): ChangeableAttribute<E, number>;
        (apply: (el: E, value: number) => void): ChangeableAttribute<E, number>;
    };
}

/** The names of `E`'s number properties. */
export type NumberPropertyOf<E> = { [K in keyof E & string]: E[K] extends number ? K : never }[keyof E & string];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The attribute helpers for elements of type `E`:
 *
 * ```ts
 * const container = attributesOf<Container>();
 * const containerAttributes = {
 *     x: container.everyFrame('x'),
 *     scale: container.everyFrame((e, v: number) => { e.scale.set(v); }),
 * };
 * ```
 *
 * **Name a property wherever the write is a plain assignment.** Generated
 * refresh methods assign a named property inline, so each generated method
 * has its own V8 feedback for the write, and stays fast however many kinds of
 * element share the attribute. An `apply` function is one function for every
 * element that has the attribute, so its write sees all their shapes; in a
 * mixed scene V8 gives up on it, and refresh slows by 10-40%
 * (022 section 7.5).
 */
export function attributesOf<E>(): AttributeHelpers<E> {
    return ATTRIBUTE_HELPERS as AttributeHelpers<E>;
}

/** An event handler attribute, for the event the JSX target's `listen` knows as `eventName`. */
export function event<Ev>(eventName: string): EventAttribute<Ev> {
    return { kind: 'event', eventName };
}

/**
 * An intrinsic element definition. Each attribute, and each attribute a
 * pattern makes, must accept the element `create` returns, which the type
 * checks.
 */
// Overloads rather than a default for `P`: inferred from a table's context,
// an omitted `P` would widen to its constraint, and every element would
// accept any attribute.
export function element<E, A extends Readonly<Record<string, AttributeDefinition<E>>>>(
    create: () => E,
    attributes: A,
): ElementDefinition<E, A, NoPatterns>;
export function element<
    E,
    A extends Readonly<Record<string, AttributeDefinition<E>>>,
    P extends Readonly<Record<string, AttributePattern<E>>>,
>(
    create: () => E,
    attributes: A,
    patterns: P,
): ElementDefinition<E, A, P>;
export function element<E>(
    create: () => E,
    attributes: Readonly<Record<string, AttributeDefinition<E>>>,
    patterns: Readonly<Record<string, AttributePattern<E>>> = NO_PATTERNS,
): ElementDefinition<E, object, object> {
    return { create, attributes, patterns };
}

/**
 * A JSX target's table of intrinsic elements, checked: no element may define an
 * attribute the base provides on every element (`visible`, `children` and
 * the rest), since the base would never read it.
 */
export function defineElements<T extends Readonly<Record<string, ElementDefinition<unknown, object, object>>>>(elements: T): T {
    for (const kind in elements) {
        for (const key in elements[kind].attributes) {
            if (MVT_ATTRIBUTE_KEYS.has(key)) {
                throw new Error(`<${kind}> defines '${key}', which every element already has; remove it from the table`);
            }
        }
        for (const prefix in elements[kind].patterns) {
            for (const key of MVT_ATTRIBUTE_KEYS) {
                if (key.startsWith(prefix)) {
                    throw new Error(`<${kind}> has the pattern '${prefix}', which matches '${key}', an attribute every element already has`);
                }
            }
        }
    }
    return elements;
}

/**
 * Attributes the base provides on every intrinsic element of every JSX target,
 * and handles itself. `visible` is written through the JSX target's own
 * definition of it.
 */
export const MVT_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
    'children', 'ref', 'visible', 'onUpdate', 'onRefresh', 'onDestroyed',
]);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_PATTERNS: NoPatterns = Object.freeze({});

type Writer = string | ((el: unknown, value: unknown) => void);

/** The one set of helpers, typed per element type by {@link attributesOf}. */
const ATTRIBUTE_HELPERS = {
    fixed: (writer: Writer) => define('fixed', writer),
    everyFrame: (writer: Writer) => define('every-frame', writer),
    onChange: (writer: Writer) => define('on-change', writer),
    onChangeNumber: (writer: Writer) => define('on-change-number', writer),
};

/**
 * A property name is a JavaScript identifier: generated code assigns it as
 * `e.<name>=`. Checked here, where the table is written, so nothing else can
 * reach generated source.
 */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function define(kind: 'fixed' | WriteKind, writer: Writer): FixedAttribute<unknown, unknown> | ChangeableAttribute<unknown, unknown> {
    if (typeof writer !== 'string') return { kind, apply: writer } as FixedAttribute<unknown, unknown> | ChangeableAttribute<unknown, unknown>;
    if (!IDENTIFIER.test(writer)) throw new Error(`'${writer}' is not a property name an attribute can assign`);
    // Used for fixed values, at construction, and by the closure fallback.
    // Generated methods assign the property inline instead.
    const apply = (el: unknown, value: unknown): void => {
        (el as Record<string, unknown>)[writer] = value;
    };
    return { kind, apply, property: writer } as FixedAttribute<unknown, unknown> | ChangeableAttribute<unknown, unknown>;
}
