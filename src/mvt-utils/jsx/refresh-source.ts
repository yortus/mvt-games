import type { WriteKind } from './attributes';

// Pure and dependency-free: the runtime generates refresh factories from this
// with `new Function`, and the build-time precompiler
// (`scripts/vite-plugin-jsx-precompile.ts`) writes the same source into the
// modules it transforms, so the two cannot drift.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One binding, as far as the generated code depends on it. */
export interface ShapeBinding {
    /** The attribute's key in JSX. Part of the cache key for attributes written by an apply function. */
    readonly key: string;
    readonly kind: WriteKind;
    /** The property assigned inline, or `undefined` for an attribute written by its apply function. */
    readonly property: string | undefined;
}

/**
 * The version of what this module produces: the format of
 * {@link refreshShapeKey}'s keys and the code {@link refreshFactorySource}
 * writes. The precompiler registers its factories with the version it was
 * built against, and a runtime ignores factories of any other version, so a
 * precompiler and a runtime from different releases never mix code. Bump it
 * whenever either output changes; `refresh-source.test.ts` fails until you do.
 */
export const REFRESH_SOURCE_VERSION = 1;

/** A refresh factory's source: its parameter names and its body, on one line. */
export interface RefreshSource {
    readonly params: readonly string[];
    readonly body: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The key a refresh factory is cached and registered under: whether the
 * first binding is `visible`, then each binding's write kind, and its
 * property or, for an apply function, its attribute key. Two elements with
 * the same key get the same generated code.
 *
 * Stable between build and run time, unlike anything identity-based, which
 * is what lets the precompiler register factories the runtime then finds.
 */
export function refreshShapeKey(hasVisible: boolean, bindings: readonly ShapeBinding[]): string {
    let key = hasVisible ? 'v|' : '|';
    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        key += KIND_CODES[binding.kind];
        key += binding.property === undefined ? `@${binding.key},` : `.${binding.property},`;
    }
    return key;
}

/**
 * The source of the refresh factory for a sequence of bindings. The methods it
 * makes write every-frame bindings unconditionally and on-change bindings
 * only on change.
 *
 * A factory is called once per element with the element, the skip sentinel,
 * the `UNSET` marker, the read counter, then each binding's getter and apply
 * function, and returns that element's refresh method. Generated shape, for
 * `x` (every frame, the property `x`), `scale` (every frame, an apply
 * function) and `texture` (on change, the property `texture`), laid out on
 * several lines here:
 *
 *     function (e, s, u, c, g0, a0, g1, a1, g2, a2) {
 *         var v2 = u;
 *         return function () {
 *             if (c.isCounting) c.count += 3;
 *             e.x = g0();
 *             a1(e, g1());
 *             var _2 = g2(); if (_2 !== v2) { v2 = _2; e.texture = _2; }
 *         };
 *     }
 *
 * An attribute defined by a property is assigned inline, so each generated
 * method has its own V8 feedback for the write, as the Pixi runtime's
 * generated code always had. One defined by an apply function is called: its
 * call site sees one function, and V8 inlines it, but the write inside it is
 * shared by every element that has the attribute, so in a scene of many
 * element shapes it goes megamorphic. On the falling-sand demo's sprites,
 * apply functions for `x`, `y` and `tint` made refresh 10-43% slower
 * (proposal 022 section 6.1). Hence properties wherever they fit.
 *
 * Property names come only from element tables, checked to be identifiers
 * where the table is defined; a key a caller passes that the table does not
 * define throws before it gets here.
 *
 * With a `visible` binding, it is first, and the read count is split around
 * its check, so a hidden element counts only the one read it made. The body
 * is one line, so the precompiler can put it in a module without moving any
 * of the module's own lines.
 */
export function refreshFactorySource(hasVisible: boolean, bindings: readonly ShapeBinding[]): RefreshSource {
    const params = ['e', 's', 'u', 'c'];
    const locals: string[] = [];
    const body: string[] = [];

    const readCount = bindings.length;
    if (!hasVisible) body.push(`if(c.isCounting)c.count+=${readCount};`);

    let numberCount = 0;
    for (let i = 0; i < bindings.length; i++) {
        params.push(`g${i}`, `a${i}`);
        const isVisible = hasVisible && i === 0;
        if (isVisible) body.push('if(c.isCounting)c.count++;');

        const kind = bindings[i].kind;
        const property = bindings[i].property;
        // How the value `v` is written: assigned inline to a named property,
        // or through the attribute's apply function.
        const write = (v: string): string => (property === undefined ? `a${i}(e,${v});` : `e.${property}=${v};`);
        if (kind === 'every-frame') {
            body.push(isVisible ? `var _${i}=g${i}();${write(`_${i}`)}` : write(`g${i}()`));
        }
        else {
            // Where the last value written is kept.
            let last: string;
            if (kind === 'on-change-number') {
                last = `n[${numberCount++}]`;
            }
            else {
                last = `v${i}`;
                locals.push(`var v${i}=u;`);
            }
            body.push(`var _${i}=g${i}();if(_${i}!==${last}){${last}=_${i};${write(`_${i}`)}}`);
        }

        if (isVisible) {
            body.push(`if(!_${i})return s;`);
            if (readCount > 1) body.push(`if(c.isCounting)c.count+=${readCount - 1};`);
        }
    }
    if (numberCount > 0) locals.push(`var n=new Float64Array(${numberCount}).fill(NaN);`);

    return { params, body: `${locals.join('')}return function(){${body.join('')}};` };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KIND_CODES: Readonly<Record<WriteKind, string>> = {
    'every-frame': 'e',
    'on-change': 'c',
    'on-change-number': 'n',
};
