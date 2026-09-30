import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import { attributesOf, defineElements, element, event } from '../../mvt-utils/jsx';

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

// Plain assignments name their property, which generated refresh methods
// assign inline; see `attributesOf`. The rest are apply functions.

const container = attributesOf<Container>();
const anchored = attributesOf<Sprite | Text>();
const sprite = attributesOf<Sprite>();
const text = attributesOf<Text>();
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
        texture: sprite.onChange('texture'),
        tint: sprite.onChange('tint'),
        width: sprite.onChangeNumber('width'),
        height: sprite.onChangeNumber('height'),
    }),
    text: element(() => new Text(), {
        ...containerAttributes,
        ...anchorAttributes,
        text: text.onChange('text'),
        style: text.onChange((e, v: Record<string, unknown>) => { Object.assign(e.style, v); }),
    }),
    graphics: element(() => new Graphics(), {
        ...containerAttributes,
        tint: graphics.onChange('tint'),
    }),
});
