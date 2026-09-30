/** @jsxImportSource #html-mvt/jsx */
import type { FlockModel } from '../boids';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlockPanelViewBindings {
    readonly model: FlockModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An HTML panel for the flock: sliders for its size and its steering
 * weights, beside the three.js view of the same model. Moving a slider sets
 * the model; the three.js view and the slider both follow the model, so a
 * boid count changed by clicking in the scene moves the slider too.
 */
export function FlockPanelView({ model }: FlockPanelViewBindings): Element {
    return (
        <section class="flock-panel" aria-label="Flock settings">
            <h2 text="Flock" />
            {SETTINGS.map((setting) => (
                <RangeView
                    setting={setting}
                    value={() => model[setting.key]}
                    onValueInput={(v) => {
                        model[setting.key] = v;
                    }}
                />
            ))}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A model setting the panel has a slider for, and the slider's range. */
interface Setting {
    readonly key: 'boidCount' | 'separation' | 'alignment' | 'cohesion' | 'wander';
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
}

const SETTINGS: readonly Setting[] = [
    { key: 'boidCount', label: 'Boids', min: 20, max: 600, step: 1 },
    { key: 'separation', label: 'Separation', min: 0, max: 10, step: 0.1 },
    { key: 'alignment', label: 'Alignment', min: 0, max: 5, step: 0.1 },
    { key: 'cohesion', label: 'Cohesion', min: 0, max: 10, step: 0.1 },
    { key: 'wander', label: 'Wander', min: 0, max: 20, step: 0.5 },
];

interface RangeViewBindings {
    readonly setting: Setting;
    readonly value: () => number;
    /** The user moved the slider to `value`. */
    readonly onValueInput: (value: number) => void;
}

/** A labelled slider, with the value it shows as text beside it. */
function RangeView(bindings: RangeViewBindings): Element {
    const setting = bindings.setting;
    const id = `flock-${setting.key}`;
    return (
        <div class="range">
            <label for={id} text={setting.label} />
            <input
                id={id}
                type="range"
                min={String(setting.min)}
                max={String(setting.max)}
                step={String(setting.step)}
                valueAsNumber={bindings.value}
                onInput={(event) => {
                    bindings.onValueInput((event.currentTarget as HTMLInputElement).valueAsNumber);
                }}
            />
            <span class="range-value" text={bindings.value} />
        </div>
    );
}
