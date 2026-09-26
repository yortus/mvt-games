import type { Container } from 'pixi.js';
import { updateScene } from '../../pixi-mvt';
import type { DemoEntry, DemoSession } from '../demo-entry';
import { createCardRowModel } from './card-row-model';
import { createCardRowView } from './card-row-view';

const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 420;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReorderingListsEntry(): DemoEntry {
    return {
        id: 'reordering-lists',
        name: 'Reordering lists',
        description:
            'One row of cards, held two ways and rendered by the same index-addressed <List>. '
            + 'A script sorts, moves, inserts and removes cards in both at once, and a tap moves '
            + 'a card to the front. Both rows slide on a reorder, because each keeps its cards\' '
            + 'presentation state where it follows the card: per card id for the plain array, '
            + 'per storage slot for the OrderedSlotList. Only the OrderedSlotList row can animate '
            + 'a removal, because a removed card keeps its slot for a release delay.',
        techniques: [
            'Index-addressed <List> with no reconciliation: a reorder does no structural work',
            'Plain array: presentation state keyed by dense card id, republished per index',
            'OrderedSlotList: presentation state keyed by storage slot, position from slot.ordinal',
            'Exit effects via releaseDelayMs while the removed card\'s slot lingers',
            'All motion is view-side presentation state; the model is instantaneous',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/reordering-lists',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2200,

        start(stage: Container): DemoSession {
            const model = createCardRowModel();
            const view = createCardRowView(model);
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
