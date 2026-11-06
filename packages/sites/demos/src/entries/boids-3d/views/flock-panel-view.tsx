/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlockPanelViewBindings {
    /** How many boids there are. */
    boidCount: () => number;
    /** How strongly boids keep apart. */
    separation: () => number;
    /** How strongly boids match their neighbours' headings. */
    alignment: () => number;
    /** How strongly boids close in on their neighbours. */
    cohesion: () => number;
    /** How strongly boids wander at random. */
    wander: () => number;
    /** The visitor slid the boid count to `count`. */
    onBoidCountSlid?: (count: number) => void;
    /** The visitor slid the separation to `weight`. */
    onSeparationSlid?: (weight: number) => void;
    /** The visitor slid the alignment to `weight`. */
    onAlignmentSlid?: (weight: number) => void;
    /** The visitor slid the cohesion to `weight`. */
    onCohesionSlid?: (weight: number) => void;
    /** The visitor slid the wander to `weight`. */
    onWanderSlid?: (weight: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An HTML panel for the flock: sliders for its size and its steering
 * weights. It only shows and reports. Whoever wires it up says what each
 * slider does. Every slider follows what it is given, so a boid count changed
 * by clicking in the scene moves the slider too.
 */
export function FlockPanelView(bindings: FlockPanelViewBindings): Element {
    return (
        <section class="flock-panel" aria-label="Flock settings">
            <h2 text="Flock" />
            <RangeView
                id="flock-boidCount"
                label="Boids"
                min={20}
                max={600}
                step={1}
                value={bindings.boidCount}
                onValueInput={(count) => bindings.onBoidCountSlid?.(count)}
            />
            <RangeView
                id="flock-separation"
                label="Separation"
                min={0}
                max={10}
                step={0.1}
                value={bindings.separation}
                onValueInput={(weight) => bindings.onSeparationSlid?.(weight)}
            />
            <RangeView
                id="flock-alignment"
                label="Alignment"
                min={0}
                max={5}
                step={0.1}
                value={bindings.alignment}
                onValueInput={(weight) => bindings.onAlignmentSlid?.(weight)}
            />
            <RangeView
                id="flock-cohesion"
                label="Cohesion"
                min={0}
                max={10}
                step={0.1}
                value={bindings.cohesion}
                onValueInput={(weight) => bindings.onCohesionSlid?.(weight)}
            />
            <RangeView
                id="flock-wander"
                label="Wander"
                min={0}
                max={20}
                step={0.5}
                value={bindings.wander}
                onValueInput={(weight) => bindings.onWanderSlid?.(weight)}
            />
        </section>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface RangeViewBindings {
    readonly id: string;
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly value: () => number;
    /** The user moved the slider to `value`. */
    readonly onValueInput: (value: number) => void;
}

/** A labelled slider, with the value it shows as text beside it. */
function RangeView(bindings: RangeViewBindings): Element {
    const { id, min, max } = bindings;
    let shownValue = Number.NaN;
    return (
        <div class="range">
            <label for={id} text={bindings.label} />
            <input
                id={id}
                type="range"
                min={String(min)}
                max={String(max)}
                step={String(bindings.step)}
                valueAsNumber={bindings.value}
                onInput={(event) => {
                    bindings.onValueInput((event.currentTarget as HTMLInputElement).valueAsNumber);
                }}
                onRefresh={showFill}
            />
            <span class="range-value" text={bindings.value} />
        </div>
    );

    /** Sets `--fill` to the thumb's place, which the stylesheet colours the track up to. */
    function showFill(slider: HTMLInputElement): void {
        const value = bindings.value();
        if (value === shownValue) return;
        shownValue = value;
        const share = (value - min) / (max - min);
        slider.style.setProperty('--fill', `${share * 100}%`);
    }
}
