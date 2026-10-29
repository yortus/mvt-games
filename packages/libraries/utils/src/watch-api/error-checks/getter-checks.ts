import type { Getter } from '../watched';

// Each type here is the getters `S` when the tool can use them, and otherwise a message saying why not. A factory
// takes `watch: S & Checked<S>`, so TypeScript shows the message as the error on `watch`.

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export type CheckedWatchGetters<S> = S extends readonly []
    ? 'An empty array never changes: give watch at least one getter'
    : S extends Getter | readonly Getter[]
        ? S
        : IsEmptyRecord<S> extends true
            ? 'An empty record never changes: give watch at least one getter'
            : 'anyChanged' extends keyof S
                ? "A getter can't be called anyChanged: the reading uses that name"
                : S;

export type CheckedReactionGetters<S> = S extends readonly []
    ? 'An empty array never reacts: give watch at least one getter'
    : IsAllSame<S> extends true
        ? S
        : 'Every getter in the array must return the same type, since they share `when`';

export type CheckedComputedGetters<S> = S extends readonly unknown[]
    ? 'A computed value watches one getter or a record of getters, not an array: name the values in a record'
    : S extends Getter
        ? S
        : IsEmptyRecord<S> extends true
            ? 'An empty record never changes: give watch at least one getter'
            : S;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type IsEmptyRecord<S> = [keyof S] extends [never] ? true : false;

/** Whether every getter in an array returns exactly the same type. Always true for one getter. */
type IsAllSame<S> = S extends readonly [() => infer F, ...(readonly unknown[])]
    ? IsEveryReturn<S, F>
    : S extends readonly (infer E)[]
        ? IsOneReturn<E>
        : true;

/** Whether every getter in a tuple returns exactly `F`. */
type IsEveryReturn<S extends readonly unknown[], F> = {
    [I in keyof S]: S[I] extends () => infer R ? Equal<R, F> : false;
}[number] extends true ? true : false;

/**
 * Whether the getters of an array that isn't a tuple, such as a literal array
 * held in a variable, return one type. Their return types, each wrapped as
 * `[R]`, merge into one when they're the same, and stay a union when they
 * differ.
 */
type IsOneReturn<E> = true extends IsUnion<E extends () => infer R ? [R] : never> ? false : true;

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;
