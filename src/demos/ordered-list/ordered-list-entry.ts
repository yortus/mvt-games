import type { Container } from 'pixi.js';
import { updateScene } from '../../pixi-mvt';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createOrderedListDemoModel } from './ordered-list-model';
import { createOrderedListView } from './ordered-list-view';

const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 260;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrderedListEntry(): DemoEntry {
    return {
        id: 'ordered-slot-list',
        name: 'OrderedSlotList: reorder and exit',
        description:
            'A row of cards driven by an OrderedSlotList. Each mutation - append, '
            + 'sort, move, insertAt, remove - runs on a timer. Card views are pooled by '
            + 'stable storage index and ease toward each slot\'s ordinal, so reorders '
            + 'slide with no reconciliation. A removed card keeps its slot for a release '
            + 'delay, so it fades and floats out while the survivors close the gap.',
        techniques: [
            'OrderedSlotList: storage index for identity, ordinal for layout',
            'View pooled by stable storage index (list.slots)',
            'Reorder animates by easing toward slot.ordinal - no watch, no diff',
            'Exit effects via releaseDelayMs while the slot lingers',
            'All motion is view-side presentation state; the model is instantaneous',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/ordered-list',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2200,

        start(stage: Container): DemoSession {
            const model = createOrderedListDemoModel();
            const view = createOrderedListView(model);
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    updateScene(view, deltaMs);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
}
