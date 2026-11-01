import type { CheatSheet } from './cheat-sheet';
import { JSX_ATTRIBUTE_ENTRIES } from './jsx-attribute-entries';

/** Views written in JSX, for HTML. */
export const HTML_JSX_SHEET: CheatSheet = {
    id: 'html-jsx',
    title: 'JSX',
    summary: 'Views written as JSX, for HTML elements. Start a `.tsx` file with `/** @jsxImportSource @mvtjs/html */`.',
    renderers: ['html'],
    groups: [
        {
            title: 'Elements',
            entries: [
                {
                    name: '<div> and the other tags',
                    signature: '<div class={...} text={...} style="..." title={...}>',
                    useFor: 'Build the page from elements. Change how one looks as the model changes with `class`. Its `style` is set once.',
                    snippet: [
                        "<div class={() => (model.isWon ? 'board won' : 'board')}>",
                        '    <span class="score" text={scoreText} />',
                        '</div>',
                    ].join('\n'),
                },
                {
                    name: 'text',
                    signature: 'text={string | (() => string)}',
                    useFor: "Put text in an element. It's the only way to: JSX text between tags isn't supported, so an element with text has no children.",
                },
                {
                    name: 'onClick',
                    signature: 'onClick={(event: MouseEvent) => void}',
                    useFor: "Report a click. There's `onInput`, `onChange`, `onKeyDown`, `onPointerDown` and the rest too.",
                    snippet: '<button type="button" text="Reset" onClick={() => model.reset()} />',
                },
                {
                    name: '<input>',
                    signature: '<input type="..." value={...} checked={...} disabled={...} onInput={...}>',
                    useFor: "Take the player's input, and show the model's value in the field as it changes.",
                    snippet: [
                        '<input',
                        '    type="range"',
                        '    valueAsNumber={() => model.speed}',
                        '    onInput={(e) => {',
                        '        model.speed = (e.target as HTMLInputElement).valueAsNumber;',
                        '    }}',
                        '/>',
                    ].join('\n'),
                },
                {
                    name: 'data- and aria- attributes',
                    signature: 'data-name={...}\naria-label={...}',
                    useFor: "Set an element's `data-*` and `aria-*` attributes, for your CSS and for screen readers.",
                },
            ],
        },
        {
            title: 'Attributes of every element',
            entries: JSX_ATTRIBUTE_ENTRIES,
        },
        {
            title: 'Lists and switches',
            entries: [
                {
                    name: 'List',
                    from: '@mvtjs/html',
                    signature: '<List items={() => readonly T[]}>{(item: () => T, index: number) => view}</List>',
                    useFor: 'Show an element for each item in an array, such as each row of a table. The item is a getter.',
                    snippet: [
                        '<ul>',
                        '    <List items={() => model.scores}>',
                        '        {(score) => <li text={() => score().name} />}',
                        '    </List>',
                        '</ul>',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Switch',
                    from: '@mvtjs/html',
                    signature: '<Switch>{<Match> elements}</Switch>',
                    useFor: 'Show one of several views, whichever `<Match>` matches first.',
                    snippet: [
                        '<Switch>',
                        "    <Match when={() => model.phase === 'title'}>",
                        '        <TitleView />',
                        '    </Match>',
                        '    <Match else>',
                        '        <GameView model={model} />',
                        '    </Match>',
                        '</Switch>',
                    ].join('\n'),
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'Match',
                    from: '@mvtjs/html',
                    signature: '<Match when={() => boolean}>\n<Match else>',
                    useFor: 'Give a `<Switch>` a branch, shown while its `when` is true, or as the last branch, `else`.',
                    chapter: 'chapters/14-lists-and-switches',
                },
                {
                    name: 'MVT_GROUP_CSS',
                    from: '@mvtjs/html',
                    useFor: "Add this CSS rule to your page when a `<List>` or `<Switch>` sits in a grid or a flexbox, so the element that holds its children doesn't change the layout.",
                    snippet: [
                        "const style = document.createElement('style');",
                        'style.textContent = MVT_GROUP_CSS;',
                        'document.head.append(style);',
                    ].join('\n'),
                },
            ],
        },
    ],
};
