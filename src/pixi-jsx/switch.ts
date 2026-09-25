/**
 * `<Switch>` and `<Match>` function components: show the first branch whose
 * condition holds.
 *
 * ```tsx
 * <Switch>
 *     <Match when={() => model.boss?.isEnraged === true}>
 *         <sprite texture={enragedTexture} />
 *     </Match>
 *     <Match when={() => model.boss !== undefined}>
 *         <text text={() => `HP ${model.boss!.hp}`} />
 *     </Match>
 *     <Match else>
 *         <text text="No boss" />
 *     </Match>
 * </Switch>
 * ```
 *
 * `<Match else>` is the default branch, shown when no `when` holds. It is
 * optional, and must be the last `<Match>`. With no default and no match,
 * nothing is shown, which is often what is meant. To make an unhandled case an
 * error instead, give the default a child that throws; it is only called when
 * that branch is first selected:
 *
 * ```tsx
 * <Match else>{() => { throw new Error(`Unhandled kind: ${enemy().kind}`); }}</Match>
 * ```
 *
 * Every branch is built up front and kept; switching only changes which one is
 * visible, so it never restructures the scene. An unselected branch returns
 * `SKIP_DESCENDANTS`, so its bindings never run. With construction inert, that
 * means a binding such as `model.boss!.hp` only ever runs while its `when`
 * holds.
 *
 * For a heavy branch, pass a function as the `<Match>` child to build it on
 * first selection instead: `<Match when={...}>{() => <Heavy />}</Match>`.
 *
 * See section 5 of `proposals/004-list-proposal.md` for the design.
 */

import { Container } from 'pixi.js';
import { refreshScene, SKIP_DESCENDANTS } from '../pixi-mvt';
import { propReadCounter } from './prop-reads';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SwitchProps {
    /**
     * `<Match>` elements, tested in order; the first whose `when` holds wins.
     * A final `<Match else>` wins if none does.
     */
    children?: Container | Container[];
    /** Handle on the switch's own container. */
    ref?: (el: Container) => void;
}

/**
 * A conditional branch (`when`) or the default branch (`else`), never both.
 * The two are exclusive in the type, so a `<Match>` with neither, which would
 * otherwise be a silent catch-all, does not compile.
 */
export type MatchProps = MatchBaseProps & (
    | {
        /** Whether this branch applies. Polled every frame by the enclosing `<Switch>`. */
        when: () => boolean;
        else?: never;
    }
    | {
        /** Marks the default branch, shown when no `when` holds. Must be the last `<Match>`. */
        else: true;
        when?: never;
    }
);

interface MatchBaseProps {
    /**
     * The branch. Plain JSX children are built up front, like any element.
     * A function is called on the branch's first selection, for branches too
     * heavy to build in every slot of a list.
     */
    children?: Container | Container[] | (() => Container);
    /** Handle on the match's own container. */
    ref?: (el: Container) => void;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function Switch(props: SwitchProps): Container {
    const container = new Container();

    // Collected at construction: the children already exist, since JSX builds
    // children before their parents. No `when` is called until the first
    // refresh. `undefined` in `conditions` marks the default branch.
    const branches: Container[] = [];
    const conditions: ((() => boolean) | undefined)[] = [];
    const children = props.children === undefined ? [] : Array.isArray(props.children) ? props.children : [props.children];
    for (let i = 0; i < children.length; i++) {
        const match = matches.get(children[i]);
        if (match === undefined) {
            throw new Error('<Switch> children must be <Match> elements');
        }
        if (match.when === undefined && i !== children.length - 1) {
            // Also covers a second `<Match else>`, since only one can be last
            throw new Error('<Match else> must be the last <Match> in its <Switch>; any after it could never be shown');
        }
        match.isAdopted = true;
        branches.push(children[i]);
        conditions.push(match.when);
    }

    // Index into `branches` of the one shown, or -1 for none.
    let selected = -1;

    for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const index = i;
        branch.visible = false;
        container.addChild(branch);

        // Wraps the `<Match>`'s own `onRefresh` (its misuse check and lazy build) in
        // a gate, so it only runs while its branch is selected.
        const ownRefresh = branch.onRefresh;
        branch.onRefresh = () => {
            if (index !== selected) return SKIP_DESCENDANTS;
            return ownRefresh?.();
        };
    }

    // Runs before any branch's `onRefresh`, so a newly selected branch refreshes on
    // the frame it is selected, with no structural change and no lag.
    container.onRefresh = select;

    return container;

    function select(): void {
        // A few conditions at most, so a linear scan is the right cost model:
        // at most one call per branch, stopping at the first that holds. The
        // default branch, if any, is last and always holds.
        let next = -1;
        for (let i = 0; i < conditions.length; i++) {
            const when = conditions[i];
            if (when !== undefined && propReadCounter.isCounting) propReadCounter.count++;
            if (when === undefined || when()) {
                next = i;
                break;
            }
        }
        if (next === selected) return;

        if (selected !== -1) branches[selected].visible = false;
        if (next !== -1) branches[next].visible = true;
        selected = next;
    }
}

export function Match(props: MatchProps): Container {
    const container = new Container();
    // `else` is a reserved word, so it is read as a property, never destructured
    const entry: MatchEntry = { when: props.else === true ? undefined : props.when, isAdopted: false };
    matches.set(container, entry);

    const children = props.children;
    let build: (() => Container) | undefined;
    if (typeof children === 'function') {
        // Lazy branch: built on first selection
        build = children;
    }
    else if (Array.isArray(children)) {
        for (let i = 0; i < children.length; i++) container.addChild(children[i]);
    }
    else if (children !== undefined) {
        container.addChild(children);
    }

    // The enclosing `<Switch>` wraps this and only lets it run while this
    // branch is selected. Without one, nothing would ever hide the branch, so
    // fail loudly instead.
    container.onRefresh = () => {
        if (!entry.isAdopted) throw new Error('<Match> must be a direct child of <Switch>');
        if (build === undefined) return;
        const branch = build();
        build = undefined;
        container.addChild(branch);
        // Added mid-pass, so the running pass will not visit it this frame
        refreshScene(branch);
    };

    return container;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * `<Match>` containers and their conditions. `JSX.Element` is `Container`, so a
 * `<Match>` must return a real container; this side table is how `<Switch>`
 * tells a `<Match>` apart from any other child and reads its `when`.
 */
const matches = new WeakMap<Container, MatchEntry>();

interface MatchEntry {
    /** The branch's condition, or `undefined` for the default (`else`) branch. */
    readonly when: (() => boolean) | undefined;
    /** Set by the enclosing `<Switch>`; still false on first refresh means misuse. */
    isAdopted: boolean;
}
