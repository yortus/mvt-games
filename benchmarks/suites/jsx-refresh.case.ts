import { BitmapText, Container, Graphics, HTMLText, NineSliceSprite, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { JsxFactory } from '#mvt-utils/jsx';
import { jsx as pixiJsx } from '#pixi-mvt/jsx';
import { setTickMethods, tickScene } from '../../src/pixi-mvt';
import { readParams, report, timeFrames } from '../harness/measure';

// Measured file for the `jsx-refresh` suite: microseconds per frame to change
// the model and refresh the view, with the JSX runtime's refresh methods and
// with hand-written refresh methods.
//
// scene `uniform`: containers binding `x`, `y` and `alpha`, all changing
//   every frame.
// scene `mixed`: six element shapes in turn, over every write kind: every
//   frame (`x`, `alpha`, `scale`...), on change (`tint` and `texture`, every
//   60 frames) and on change as a number (`width`, fractional, every frame).
// scene `kinds`: all eight kinds of Pixi element in turn, each binding `x`,
//   `y`, `alpha` and `rotation`, every frame. One shape on eight classes of
//   element: a write shared by all eight is more than V8 keeps fast
//   (megamorphic). Hand-written code has a view per kind; the JSX runtime
//   gives each class a copy of the refresh code of its own.

const params = readParams();
const scene = String(params.scene);
const approach = String(params.approach);
const count = Number(params.count);

const TEXTURE_A = Texture.WHITE;
const TEXTURE_B = Texture.EMPTY;
const KINDS = ['container', 'sprite', 'graphics', 'text', 'bitmapText', 'htmlText', 'tilingSprite', 'nineSliceSprite'] as const;

const items = createItems(count);
const root = new Container();
const jsx = approach === 'hand-written' ? undefined : pixiJsx;
for (let i = 0; i < count; i++) root.addChild(createView(i, items[i], jsx));

let tick = 0;
report({
    usPerFrame: timeFrames(() => {
        tick++;
        changeItems(tick);
        tickScene({ root, only: 'refresh' });
    }),
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface ItemModel {
    x: number;
    y: number;
    alpha: number;
    rotation: number;
    scale: number;
    pivotX: number;
    width: number;
    tint: number;
    texture: Texture;
}

function createItems(n: number): ItemModel[] {
    const result: ItemModel[] = [];
    for (let i = 0; i < n; i++) {
        result.push({ x: i, y: i, alpha: 1, rotation: 0, scale: 1, pivotX: 0, width: 10.5, tint: 0xffffff, texture: TEXTURE_A });
    }
    return result;
}

function changeItems(frame: number): void {
    const isSlowChange = frame % 60 === 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.x = (item.x + 1) % 800;
        item.y = (item.y + 2) % 600;
        item.alpha = (frame % 100) / 100;
        item.rotation += 0.01;
        item.scale = 1 + (frame % 10) / 10;
        item.pivotX = frame % 7;
        item.width = 10 + (frame % 50) * 0.37;
        if (isSlowChange) {
            item.tint = item.tint === 0xffffff ? 0xff0000 : 0xffffff;
            item.texture = item.texture === TEXTURE_A ? TEXTURE_B : TEXTURE_A;
        }
    }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function createView(index: number, item: ItemModel, jsxOrUndefined: JsxFactory<Container> | undefined): Container {
    if (scene === 'kinds') {
        const kind = index % KINDS.length;
        return jsxOrUndefined === undefined ? createHandWrittenKind(kind, item) : createJsxKind(kind, item, jsxOrUndefined);
    }
    const shape = scene === 'uniform' ? 0 : index % 6;
    return jsxOrUndefined === undefined ? createHandWrittenView(shape, item) : createJsxView(shape, item, jsxOrUndefined);
}

function createJsxKind(kind: number, item: ItemModel, jsx: JsxFactory<Container>): Container {
    return jsx(KINDS[kind], { x: () => item.x, y: () => item.y, alpha: () => item.alpha, rotation: () => item.rotation });
}

/** What a person would write by hand for each kind: a view per kind, so each has its own writes. */
function createHandWrittenKind(kind: number, item: ItemModel): Container {
    switch (kind) {
        case 0: {
            const view = new Container();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 1: {
            const view = new Sprite();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 2: {
            const view = new Graphics();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 3: {
            const view = new Text();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 4: {
            const view = new BitmapText();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 5: {
            const view = new HTMLText();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 6: {
            const view = new TilingSprite();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        default: {
            const view = new NineSliceSprite({ texture: Texture.EMPTY });
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
    }
}

function createJsxView(shape: number, item: ItemModel, jsx: JsxFactory<Container>): Container {
    switch (shape) {
        case 0:
            if (scene === 'uniform') return jsx('container', { x: () => item.x, y: () => item.y, alpha: () => item.alpha });
            return jsx('container', { x: () => item.x, y: () => item.y });
        case 1: return jsx('container', { x: () => item.x, y: () => item.y, alpha: () => item.alpha, rotation: () => item.rotation });
        case 2: return jsx('sprite', { texture: TEXTURE_A, x: () => item.x, y: () => item.y, tint: () => item.tint, width: () => item.width });
        case 3: return jsx('sprite', { x: () => item.x, texture: () => item.texture });
        case 4: return jsx('container', { scale: () => item.scale, pivotX: () => item.pivotX });
        default: return jsx('graphics', { x: () => item.x, y: () => item.y, tint: () => item.tint });
    }
}

/** What a person would write by hand for each shape, with the same writes. */
function createHandWrittenView(shape: number, item: ItemModel): Container {
    switch (shape) {
        case 0: {
            const view = new Container();
            if (scene === 'uniform') {
                setTickMethods(view, {
                    refresh: () => {
                        view.x = item.x;
                        view.y = item.y;
                        view.alpha = item.alpha;
                    },
                });
            }
            else {
                setTickMethods(view, {
                    refresh: () => {
                        view.x = item.x;
                        view.y = item.y;
                    },
                });
            }
            return view;
        }
        case 1: {
            const view = new Container();
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    view.alpha = item.alpha;
                    view.rotation = item.rotation;
                },
            });
            return view;
        }
        case 2: {
            const view = new Sprite(TEXTURE_A);
            let shownTint = NaN;
            const shownWidth = new Float64Array(1).fill(NaN);
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    if (item.tint !== shownTint) view.tint = shownTint = item.tint;
                    if (item.width !== shownWidth[0]) view.width = shownWidth[0] = item.width;
                },
            });
            return view;
        }
        case 3: {
            const view = new Sprite();
            let shownTexture: Texture | undefined;
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    if (item.texture !== shownTexture) view.texture = shownTexture = item.texture;
                },
            });
            return view;
        }
        case 4: {
            const view = new Container();
            setTickMethods(view, {
                refresh: () => {
                    view.scale.set(item.scale);
                    view.pivot.x = item.pivotX;
                },
            });
            return view;
        }
        default: {
            const view = new Graphics();
            let shownTint = NaN;
            setTickMethods(view, {
                refresh: () => {
                    view.x = item.x;
                    view.y = item.y;
                    if (item.tint !== shownTint) view.tint = shownTint = item.tint;
                },
            });
            return view;
        }
    }
}
