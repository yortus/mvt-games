import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { DoorModel } from '../models';
import { DoorView } from './door-view';
import { DOOR_HEIGHT, DOOR_WIDTH } from './draw-door-panel';
import { SnappingDoorView } from './snapping-door-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CorridorViewBindings {
    readonly model: DoorModel;
    /** The size of the play area, which takes clicks. Read once. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A wall on a spaceship, with the model's one door shown in two doorways:
 * on the left by a view that snaps, and on the right by one that slides.
 * Click, or press Space, to open or shut the door.
 */
export function CorridorView({ model, width, height }: CorridorViewBindings): Container {
    const view = new Container();

    const doorways = [
        { x: 110, label: 'SnappingDoorView: snaps', door: SnappingDoorView({ isOpen: () => model.isOpen }) },
        { x: 390, label: 'DoorView: slides', door: DoorView({ isOpen: () => model.isOpen }) },
    ];
    for (let i = 0; i < doorways.length; i++) {
        const { x, label, door } = doorways[i];
        view.addChild(drawDoorway(x, DOOR_TOP));
        door.position.set(x, DOOR_TOP);
        view.addChild(door, makeText(label, x + DOOR_WIDTH / 2, DOOR_TOP + DOOR_HEIGHT + 34, 0xffffff));
    }

    const state = makeText('', width / 2, 22, 0x8899bb);
    view.addChild(state);

    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointertap', toggleDoor);
    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        state.text = model.isOpen ? 'the model: isOpen is true' : 'the model: isOpen is false';
    }

    function toggleDoor(): void {
        if (model.isOpen) model.close();
        else model.open();
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key !== ' ' || e.repeat) return;
        // Stops Space scrolling the page
        e.preventDefault();
        toggleDoor();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DOOR_TOP = 68;

/**
 * A doorway in the ship's wall: a steel frame with a warning light in each
 * top corner, and a corridor beyond, lit at its far end.
 */
function drawDoorway(x: number, y: number): Graphics {
    const doorway = new Graphics();

    // The frame, and the light in each top corner, with a glow round it
    doorway.rect(x - 16, y - 26, DOOR_WIDTH + 32, DOOR_HEIGHT + 32).fill(0x3a4252);
    doorway.rect(x - 6, y - 6, DOOR_WIDTH + 12, DOOR_HEIGHT + 12).fill(0x262c38);
    for (let i = 0; i < 2; i++) {
        const lightX = i === 0 ? x + 6 : x + DOOR_WIDTH - 6;
        doorway.circle(lightX, y - 16, 9).fill({ color: 0xffa040, alpha: 0.25 });
        doorway.circle(lightX, y - 16, 4).fill(0xffa040);
    }

    // The corridor, its walls running towards the lit end
    const farX = x + DOOR_WIDTH * 0.32;
    const farY = y + DOOR_HEIGHT * 0.3;
    const farWidth = DOOR_WIDTH * 0.36;
    const farHeight = DOOR_HEIGHT * 0.4;
    doorway.rect(x, y, DOOR_WIDTH, DOOR_HEIGHT).fill(0x080b12);
    doorway.rect(farX, farY, farWidth, farHeight).fill(0x2b4a66);
    doorway.moveTo(x, y).lineTo(farX, farY);
    doorway.moveTo(x + DOOR_WIDTH, y).lineTo(farX + farWidth, farY);
    doorway.moveTo(x, y + DOOR_HEIGHT).lineTo(farX, farY + farHeight);
    doorway.moveTo(x + DOOR_WIDTH, y + DOOR_HEIGHT).lineTo(farX + farWidth, farY + farHeight);
    doorway.stroke({ color: 0x2a3b52, width: 2 });

    // Lights along the foot of each wall, closer together as they go
    for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const footY = y + DOOR_HEIGHT + (farY + farHeight - y - DOOR_HEIGHT) * t;
        doorway.circle(x + (farX - x) * t, footY, 2).fill(0x44ddff);
        doorway.circle(x + DOOR_WIDTH + (farX + farWidth - x - DOOR_WIDTH) * t, footY, 2).fill(0x44ddff);
    }

    return doorway;
}

function makeText(text: string, x: number, y: number, fill: number): Text {
    const label = new Text({ text, style: { fontFamily: 'monospace', fontSize: 16, fill } });
    label.anchor.set(0.5, 0.5);
    label.position.set(x, y);
    return label;
}
