import type { DemoModel } from '../models';
import { ScopeView } from './scope-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    readonly model: DemoModel;
    /** Whether the keyboard works the scope. It doesn't while the scope plays only to be watched. */
    readonly takesKeys: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The whole demo: the scope, as the visitor sees and works it. */
export function DemoView(bindings: DemoViewBindings): Element {
    const { model, takesKeys } = bindings;
    return ScopeView({ model: model.scope, takesKeys });
}
