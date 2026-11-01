import type { CheatSheet } from './cheat-sheet';

/** Slot lists, for a model's collections whose items come and go. */
export const COLLECTIONS_SHEET: CheatSheet = {
    id: 'collections',
    title: 'Collections',
    summary: 'Collections for a model whose items come and go, such as bullets. Each item keeps its slot for its whole life, so a view of the slot can keep its own state. A view shows them with `<List>`, on the JSX sheet.',
    groups: [
        {
            title: 'Slot lists',
            entries: [
                {
                    name: 'createSlotList',
                    from: '@mvtjs/utils',
                    useFor: "Keep items that come and go, such as bullets, each in a slot of its own until it's removed. A removed item's slot is reused.",
                    snippet: [
                        'const bullets = createSlotList<Bullet>({ maxSlots: 64 });',
                        'const slot = bullets.insert({ x: 0, y: 0 });',
                        '// Later, as it leaves the screen',
                        'bullets.remove(slot);',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'SlotList',
                    from: '@mvtjs/utils',
                    useFor: 'See what a slot list has: its `slots`, which a `<List>` shows, and how to insert, remove and visit the live items.',
                },
                {
                    name: 'createOrderedSlotList',
                    from: '@mvtjs/utils',
                    useFor: 'Keep items in an order that changes, such as a hand of cards, while each keeps its slot. Its `ordered` list follows the order.',
                    chapter: 'chapters/14-lists-and-switches',
                },
            ],
        },
    ],
};
