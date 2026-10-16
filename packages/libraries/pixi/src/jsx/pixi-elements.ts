import { BitmapText, Container, Graphics, HTMLText, NineSliceSprite, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import type { ColorSource, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import { attributesOf, defineElements, element, event } from '@mvtjs/utils/jsx';

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

// Plain assignments name their property, which refresh methods assign
// directly; see `attributesOf`. The rest are apply functions.
//
// `tint` is an apply function though its write is a plain assignment. Pixi's
// `tint` setters take any `ColorSource` (a number, or a CSS colour such as
// `'#ff5468'`), but their getters return a number, and a named property is
// typed by its getter. An apply function lets TypeScript check the value
// against the setter itself. It costs little: `tint` is written only when it
// changes, so only frames where a tint changes take the slower write.

const container = attributesOf<Container>();
const anchored = attributesOf<Sprite | Text | BitmapText | HTMLText | TilingSprite | NineSliceSprite>();
const textured = attributesOf<Sprite | TilingSprite | NineSliceSprite>();
const texts = attributesOf<Text | BitmapText | HTMLText>();
const tiling = attributesOf<TilingSprite>();
const graphics = attributesOf<Graphics>();

/** Attributes every Pixi element accepts. */
const containerAttributes = {
    x: container.everyFrame('x'),
    y: container.everyFrame('y'),
    alpha: container.everyFrame('alpha'),
    rotation: container.everyFrame('rotation'),
    scale: container.everyFrame((e, v: number) => { e.scale.set(v); }),
    scaleX: container.everyFrame((e, v: number) => { e.scale.x = v; }),
    scaleY: container.everyFrame((e, v: number) => { e.scale.y = v; }),
    pivotX: container.everyFrame((e, v: number) => { e.pivot.x = v; }),
    pivotY: container.everyFrame((e, v: number) => { e.pivot.y = v; }),
    zIndex: container.everyFrame('zIndex'),
    cursor: container.everyFrame('cursor'),
    label: container.onChange('label'),
    sortableChildren: container.fixed('sortableChildren'),
    isRenderGroup: container.fixed('isRenderGroup'),
    hitArea: container.fixed('hitArea'),
    /**
     * The container that masks this one. The mask is not added to the tree:
     * add it yourself, usually as a child of the element it masks, so it
     * moves with it:
     *
     * ```tsx
     * const mask = <graphics ref={drawMask} />;
     * <container mask={mask}>{mask}{content}</container>
     * ```
     */
    mask: container.fixed('mask'),
    /**
     * How the element takes part in pointer events. Without it, an element
     * with an event handler attribute is made `'static'`.
     */
    eventMode: container.fixed('eventMode'),
    onPointerDown: event<FederatedPointerEvent>('pointerdown'),
    onPointerUp: event<FederatedPointerEvent>('pointerup'),
    onPointerUpOutside: event<FederatedPointerEvent>('pointerupoutside'),
    onPointerCancel: event<FederatedPointerEvent>('pointercancel'),
    onPointerTap: event<FederatedPointerEvent>('pointertap'),
    onPointerOver: event<FederatedPointerEvent>('pointerover'),
    onPointerOut: event<FederatedPointerEvent>('pointerout'),
    onPointerMove: event<FederatedPointerEvent>('pointermove'),
    onGlobalPointerMove: event<FederatedPointerEvent>('globalpointermove'),
    onWheel: event<FederatedWheelEvent>('wheel'),
};

/** Attributes of elements with an anchor, set once. */
const anchorAttributes = {
    anchor: anchored.fixed((e, v: number) => { e.anchor.set(v); }),
    anchorX: anchored.fixed((e, v: number) => { e.anchor.x = v; }),
    anchorY: anchored.fixed((e, v: number) => { e.anchor.y = v; }),
};

/** Attributes of sprites of every kind. */
const texturedAttributes = {
    texture: textured.onChange('texture'),
    tint: textured.onChange((e, v: ColorSource) => { e.tint = v; }),
    width: textured.onChangeNumber('width'),
    height: textured.onChangeNumber('height'),
};

/** Attributes of text of every kind. */
const textAttributes = {
    text: texts.onChange('text'),
    tint: texts.onChange((e, v: ColorSource) => { e.tint = v; }),
    style: texts.onChange((e, v: Record<string, unknown>) => { Object.assign(e.style, v); }),
};

/**
 * Pixi's intrinsic elements. Each attribute says how it is written: `fixed`
 * takes only a value; `everyFrame` writes a getter's result every frame, for
 * cheap writes; `onChange` writes it only when it changes, for writes that
 * cost something even when unchanged; `onChangeNumber` is `onChange` for
 * numbers that may be fractional (`width` and `height`, which Pixi applies
 * through the scale, and which are often fractional).
 */
export const pixiElements = defineElements({
    container: element(() => new Container(), containerAttributes),
    sprite: element(() => new Sprite(), {
        ...containerAttributes,
        ...anchorAttributes,
        ...texturedAttributes,
    }),
    tilingSprite: element(() => new TilingSprite(), {
        ...containerAttributes,
        ...anchorAttributes,
        ...texturedAttributes,
        tilePositionX: tiling.everyFrame((e, v: number) => { e.tilePosition.x = v; }),
        tilePositionY: tiling.everyFrame((e, v: number) => { e.tilePosition.y = v; }),
    }),
    nineSliceSprite: element(() => new NineSliceSprite({ texture: Texture.EMPTY }), {
        ...containerAttributes,
        ...anchorAttributes,
        ...texturedAttributes,
    }),
    text: element(() => new Text(), {
        ...containerAttributes,
        ...anchorAttributes,
        ...textAttributes,
    }),
    bitmapText: element(() => new BitmapText(), {
        ...containerAttributes,
        ...anchorAttributes,
        ...textAttributes,
    }),
    htmlText: element(() => new HTMLText(), {
        ...containerAttributes,
        ...anchorAttributes,
        ...textAttributes,
    }),
    graphics: element(() => new Graphics(), {
        ...containerAttributes,
        tint: graphics.onChange((e, v: ColorSource) => { e.tint = v; }),
    }),
});
