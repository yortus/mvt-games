import type { CheatSheetEntry } from './cheat-sheet';

/** The attributes every element takes, whatever the renderer, as each JSX sheet lists them. */
export const JSX_ATTRIBUTE_ENTRIES: readonly CheatSheetEntry[] = [
    {
        name: 'Getters for values that change',
        signature: 'attribute={value}\nattribute={() => value}',
        useFor: 'Pass a getter, `() => value`, for a value that changes. The view reads it every tick. Pass a plain value for one that never changes.',
        chapter: 'chapters/12-writing-views-in-jsx',
    },
    {
        name: 'visible',
        signature: 'visible={() => boolean}',
        useFor: "Show or hide an element as the model changes. While it's hidden, its children aren't refreshed at all.",
        chapter: 'chapters/12-writing-views-in-jsx',
    },
    {
        name: 'ref',
        signature: 'ref={(element) => void}',
        useFor: "Do something to an element once it's made, such as drawing shapes, which an attribute can't do.",
        chapter: 'chapters/12-writing-views-in-jsx',
    },
    {
        name: 'onRefresh',
        signature: 'onRefresh={(element) => void}',
        useFor: "Run your own code on an element in its refresh step, every tick, for output that attributes can't write.",
        chapter: 'chapters/12-writing-views-in-jsx',
    },
    {
        name: 'onUpdate',
        signature: 'onUpdate={(deltaMs: number) => void}',
        useFor: "Move a view's own presentation state on, every tick, such as a timer for a flash that fades.",
        chapter: 'chapters/11-presentation-state',
    },
    {
        name: 'onDestroyed',
        signature: 'onDestroyed={(element) => void}',
        useFor: 'Release something as the element is destroyed, such as a listener on `window` or a texture you made.',
        chapter: 'chapters/07-views',
    },
];
