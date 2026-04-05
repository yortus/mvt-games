import { type Container } from 'pixi.js';

/**
 * A Pixi Container that also has an update method. Used for pixi views with presentation state.
 */
export type StatefulPixiView = Container & { update: (deltaMs: number) => void };
