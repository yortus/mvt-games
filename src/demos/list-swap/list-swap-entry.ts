import type { Container } from 'pixi.js';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createSwapModel } from './swap-model';
import { createSwapView } from './swap-view';

const SCREEN_WIDTH = 520;
const SCREEN_HEIGHT = 320;
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createListSwapEntry(): DemoEntry {
    return {
        id: 'list-swap',
        name: 'Reordering without reconciliation',
        description:
            'Two rows driven by one model whose only mutation is swap(a, b). The list '
            + 'is index-addressed: slot N renders whatever tile the model holds at N and '
            + 're-reads it every frame, so a swap rebuilds, moves and destroys nothing. '
            + 'The rows differ only in what their presentation state is attached to. '
            + 'Keyed by slot it cannot see the reorder and the labels jump; keyed by tile '
            + 'id the tiles slide past each other and pulse on arrival.',
        techniques: [
            'Index-addressed <List> with no reconciliation',
            'Presentation state keyed by item identity, not position',
            'Dense array cosmetic store (update() is a hot path)',
            'Per-slot republication so each binding is one array read',
            'Local slot-change detection in place of a list diff',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/list-swap',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 900,

        start(stage: Container): DemoSession {
            const model = createSwapModel({ labels: LABELS, autoSwapMs: 1400 });
            const view = createSwapView(model);
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    view.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
}
