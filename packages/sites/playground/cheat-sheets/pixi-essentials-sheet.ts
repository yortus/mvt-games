import type { CheatSheet } from './cheat-sheet';

/** The parts of Pixi that the playground's examples use most. */
export const PIXI_ESSENTIALS_SHEET: CheatSheet = {
    id: 'pixi-essentials',
    title: 'Pixi essentials',
    summary: "The parts of Pixi that most views need: containers, shapes, text and sprites. Pixi's own docs cover the rest.",
    renderers: ['pixi'],
    groups: [
        {
            title: 'Containers',
            entries: [
                {
                    name: 'Container',
                    from: 'pixi.js',
                    signature: 'new Container()',
                    useFor: 'Hold other display objects, and move, scale, turn or fade them together. A view usually returns one.',
                },
                {
                    name: 'Container.addChild',
                    from: 'pixi.js',
                    signature: 'Container.addChild(...children: Container[]): Container',
                    useFor: "Add display objects to a container, drawn in the order they're added. The stage your `start` is passed is a container.",
                },
                {
                    name: 'Container.removeChild',
                    from: 'pixi.js',
                    signature: 'Container.removeChild(...children: Container[]): Container',
                    useFor: 'Take display objects out of a container, to add them again later or to destroy them.',
                },
                {
                    name: 'Container.position',
                    from: 'pixi.js',
                    useFor: "Place a display object, relative to its parent's origin. `position.set(x, y)` sets both at once.",
                    snippet: 'ship.position.set(model.col * TILE, model.row * TILE);',
                },
                {
                    name: 'Container.scale',
                    from: 'pixi.js',
                    useFor: 'Grow or shrink a display object. `scale.set(2)` doubles it, and a negative x flips it.',
                },
                {
                    name: 'Container.rotation',
                    from: 'pixi.js',
                    useFor: 'Turn a display object about its origin, in radians.',
                },
                {
                    name: 'Container.alpha',
                    from: 'pixi.js',
                    useFor: 'Fade a display object and its children, from 0, invisible, to 1, opaque.',
                },
                {
                    name: 'Container.visible',
                    from: 'pixi.js',
                    useFor: "Hide a display object. It's still refreshed, so return `SKIP_DESCENDANTS` too, to skip its children's work.",
                },
                {
                    name: 'Container.destroy',
                    from: 'pixi.js',
                    signature: 'Container.destroy(options?: DestroyOptions): void',
                    useFor: 'Free a display object you no longer need, and its children with `{ children: true }`.',
                },
            ],
        },
        {
            title: 'Shapes',
            entries: [
                {
                    name: 'Graphics',
                    from: 'pixi.js',
                    signature: 'new Graphics()',
                    useFor: 'Draw shapes: a path, then `fill` or `stroke` it. Each call returns the graphics, so calls chain.',
                    snippet: [
                        'const ball = new Graphics()',
                        '    .circle(0, 0, 10)',
                        '    .fill(0xffcc00)',
                        '    .stroke({ width: 2, color: 0x000000 });',
                    ].join('\n'),
                },
                { name: 'Graphics.rect', from: 'pixi.js', useFor: 'Add a rectangle to the path, from its top-left corner.' },
                { name: 'Graphics.roundRect', from: 'pixi.js', useFor: 'Add a rectangle with rounded corners to the path.' },
                { name: 'Graphics.circle', from: 'pixi.js', useFor: 'Add a circle to the path, from its centre.' },
                { name: 'Graphics.ellipse', from: 'pixi.js', useFor: 'Add an ellipse to the path, from its centre.' },
                { name: 'Graphics.poly', from: 'pixi.js', useFor: 'Add a polygon to the path, from a list of points: `[x0, y0, x1, y1, ...]`.' },
                { name: 'Graphics.moveTo', from: 'pixi.js', useFor: 'Start a new line at a point, without drawing.' },
                { name: 'Graphics.lineTo', from: 'pixi.js', useFor: 'Draw a line from the last point to this one. `stroke` draws it.' },
                {
                    name: 'Graphics.fill',
                    from: 'pixi.js',
                    signature: 'Graphics.fill(style?: FillInput): Graphics',
                    useFor: 'Fill the shapes added since the last fill or stroke, with a colour, such as `0xff8800`, or `{ color, alpha }`.',
                },
                {
                    name: 'Graphics.stroke',
                    from: 'pixi.js',
                    signature: 'Graphics.stroke(style?: StrokeInput): Graphics',
                    useFor: 'Outline the shapes added since the last fill or stroke, with `{ width, color }`.',
                },
                {
                    name: 'Graphics.clear',
                    from: 'pixi.js',
                    useFor: 'Rub out everything drawn, to draw again. Redraw only when the shape changes. Moving, scaling or tinting it costs much less.',
                },
            ],
        },
        {
            title: 'Text and sprites',
            entries: [
                {
                    name: 'Text',
                    from: 'pixi.js',
                    signature: 'new Text(options?: { text, style, anchor })',
                    useFor: 'Show text. Setting its `text` makes a new texture, so set it only when the text changes.',
                    snippet: [
                        'const label = new Text({',
                        "    text: '0',",
                        "    style: { fill: 0xffffff, fontSize: 18, fontFamily: 'monospace' },",
                        '    anchor: 0.5,',
                        '});',
                    ].join('\n'),
                },
                {
                    name: 'Sprite',
                    from: 'pixi.js',
                    signature: 'new Sprite(texture?: Texture)',
                    useFor: 'Show a texture. Many sprites can share one texture.',
                },
                {
                    name: 'Sprite.anchor',
                    from: 'pixi.js',
                    useFor: 'Choose which point of a sprite or text sits at its position: `anchor.set(0.5)` centres it.',
                },
                {
                    name: 'Sprite.tint',
                    from: 'pixi.js',
                    useFor: 'Colour a sprite, multiplying its own colours, such as red for a moment as it takes a hit.',
                },
                {
                    name: 'Texture.WHITE',
                    from: 'pixi.js',
                    useFor: 'A white texture, ready made, for a sprite that you size and tint into a coloured rectangle.',
                },
            ],
        },
        {
            title: 'Pointer input',
            entries: [
                {
                    name: 'Container.eventMode',
                    from: 'pixi.js',
                    useFor: "Make a display object take pointer events: set it to `'static'`.",
                },
                {
                    name: 'Container.on',
                    from: 'pixi.js',
                    signature: "Container.on(event: 'pointertap' | 'pointerdown' | ..., listener: (event: FederatedPointerEvent) => void): Container",
                    useFor: 'Listen for a click, a tap or a press on a display object, and pass on what the player did.',
                    snippet: [
                        "button.eventMode = 'static';",
                        "button.on('pointertap', () => bindings.onStartPressed?.());",
                    ].join('\n'),
                },
                {
                    name: 'Rectangle',
                    from: 'pixi.js',
                    signature: 'new Rectangle(x: number, y: number, width: number, height: number)',
                    useFor: "Set a display object's `hitArea`, so it takes clicks across the whole of a box, not only where it draws.",
                },
            ],
        },
    ],
    moreAt: [
        { label: "Pixi's guides", url: 'https://pixijs.com/8.x/guides' },
        { label: "Pixi's API", url: 'https://pixijs.download/release/docs/index.html' },
    ],
};
