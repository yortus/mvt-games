// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How a demo touches the screen: a tap, a double tap, a press held down, or a drag through its targets in turn. */
export type DemoTouchKind = 'tap' | 'double-tap' | 'hold' | 'drag';

/**
 * One touch of a demo, on targets of the game's own kind, such as a cell or
 * a key. A tap, a double tap and a hold have one target; a drag has two or more.
 * The game's views find where on the screen each target is.
 */
export interface DemoTouch<T> {
    readonly kind: DemoTouchKind;
    readonly targets: readonly T[];
}

/** What a walkthrough shows the player how to do next: its touches, in order, or none. */
export type Demo<T> = readonly DemoTouch<T>[];

/**
 * A step of a walkthrough, played on a practice puzzle, `P`. It asks the
 * player to do one thing, is done once they have, and has a demo of how,
 * worked out from the practice puzzle as it stands. The last step asks
 * nothing, and is never done: the walkthrough ends when the player says.
 */
export interface WalkthroughStep<P, T> {
    /** What the step is for, in a word, such as `select`, for tests and readers. */
    readonly name: string;
    /** What the step asks, on the walkthrough's card. Written from the demo, for a step whose text names something in it. */
    readonly text: string | ((demo: Demo<T>) => string);
    readonly isDone: (practice: P) => boolean;
    readonly findDemo: (practice: P) => Demo<T>;
}

/** A walk through a game's controls, on a practice puzzle, a step at a time, with a demo of what to do at each. */
export interface WalkthroughModel<T> {
    /** The step's name, which step it is, from 1, and how many there are. */
    readonly stepName: string;
    readonly stepNumber: number;
    readonly stepCount: number;
    readonly isAtLastStep: boolean;
    /** What the step asks. */
    readonly text: string;
    /** The step's demo. It is replaced, never changed, as it changes. */
    readonly demo: Demo<T>;
    /** A count that rises each time the demo changes, as the player moves on or does part of a step. */
    readonly demosShown: number;
    /** Moves on a step if the player has done what this one asks, and finds the demo again if the practice puzzle changed. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WalkthroughModelOptions<P, T> {
    /** The practice puzzle the player follows the steps in. */
    readonly practice: P;
    readonly steps: readonly WalkthroughStep<P, T>[];
    /**
     * What the demo is found from, besides the step: values of the practice
     * puzzle, such as a count of its changes. The demo is found again only
     * once one of them changes, so it is not worked out every frame.
     */
    readonly findWhenChanged: readonly ((practice: P) => unknown)[];
    /** Whether two targets are the same, so a demo found again unchanged is not shown over. */
    readonly isSameTarget: (a: T, b: T) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the walkthrough at its first step, with its first demo. */
export function createWalkthroughModel<P, T>(options: WalkthroughModelOptions<P, T>): WalkthroughModel<T> {
    const { practice, steps, findWhenChanged, isSameTarget } = options;
    let index = 0;
    let demo: Demo<T> = [];
    let text = '';
    let demosShown = 0;
    // What the demo was found from, so it is only found again once one of them changes
    let foundIndex = -1;
    const foundValues: unknown[] = findWhenChanged.map(() => undefined);
    findDemo();

    return {
        get stepName() { return steps[index].name; },
        get stepNumber() { return index + 1; },
        stepCount: steps.length,
        get isAtLastStep() { return index === steps.length - 1; },
        get text() { return text; },
        get demo() { return demo; },
        get demosShown() { return demosShown; },
        update(_deltaMs) {
            if (index < steps.length - 1 && steps[index].isDone(practice)) index++;
            if (index !== foundIndex || hasPracticeChanged()) findDemo();
        },
    };

    function hasPracticeChanged(): boolean {
        for (let i = 0; i < findWhenChanged.length; i++) {
            if (findWhenChanged[i](practice) !== foundValues[i]) return true;
        }
        return false;
    }

    /** Finds the step's demo on the practice puzzle as it is, and shows it, unless it is the one shown already. */
    function findDemo(): void {
        const isNewStep = index !== foundIndex;
        foundIndex = index;
        for (let i = 0; i < findWhenChanged.length; i++) foundValues[i] = findWhenChanged[i](practice);
        const step = steps[index];
        const found = step.findDemo(practice);
        if (!isNewStep && isSameDemo(found, demo)) return;
        demo = found;
        text = typeof step.text === 'string' ? step.text : step.text(found);
        demosShown++;
    }

    function isSameDemo(a: Demo<T>, b: Demo<T>): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            const touch = a[i];
            const other = b[i];
            if (touch.kind !== other.kind || touch.targets.length !== other.targets.length) return false;
            for (let j = 0; j < touch.targets.length; j++) {
                if (!isSameTarget(touch.targets[j], other.targets[j])) return false;
            }
        }
        return true;
    }
}
