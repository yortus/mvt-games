import {
    BUTTON_BOX_DEPTH, BUTTON_BOX_WIDTH, HEAD_INSIDE_MS, BUTTON_BOX_X, CABINET_DEPTH, CABINET_SPACING, CABINET_WIDTH, CABINETS_PER_WALL, DOOR_HINT_DISTANCE,
    DOOR_WIDTH, FACING_COSINE, FINAL_DEPTH, HALL_LENGTH, HALL_WIDTH, PLAY_DISTANCE, PLAYER_RADIUS, REACH, STEP_MS, TRUNK_WIDTH, WALK_SPEED,
    WHITE_IN_MS, WHITE_OUT_MS,
} from '../data';
import { createWalkerModel, type Stand, type Strafing, type Walking } from '@mvtjs/site-kit/showcase';
import { createMeadowTerrain, type MeadowTerrain, VALLEY_WALK_HALF_WIDTH } from './meadow-terrain';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the player is doing. They walk round the hall, step up to a cabinet,
 * play it, and step back from it to walk again. Stepping up and stepping
 * back each take a moment (`STEP_MS`). In the last hall, pressing the
 * button fades the view to white as they go outside, then back again as
 * they arrive in the meadow. Going back inside from the meadow fades the
 * same way.
 */
export type HallMode = 'walking' | 'stepping-up' | 'playing' | 'stepping-back' | 'going-outside' | 'going-inside' | 'arriving';

/** A cabinet, standing on the floor with its back to a wall. */
export interface Cabinet {
    /** Its index in the hall's list, which says which game it holds. */
    readonly index: number;
    /** The middle of its footprint, in metres. */
    readonly x: number;
    readonly z: number;
    /** The way its screen faces, from +x toward +z. */
    readonly facing: number;
}

/**
 * The hall, and the player walking round it. The player is a circle on the
 * floor that walks and turns, and can't walk through the walls or the
 * cabinets. Facing a cabinet up close, the player can step up and play it.
 *
 * The cabinet at the far end holds the hall itself. Stepping up to it takes
 * the player into the hall on its screen. That's the same hall, so they
 * arrive back at the entrance, one hall deeper. The door in the entrance
 * wall leads back out to the hall outside, where the player steps back from
 * that cabinet. Every hall is the same, so only the depth changes. The door
 * of the hall itself is shut. The hall is the whole site, so there's nowhere
 * to go out to.
 *
 * The last hall, `FINAL_DEPTH` deep, is empty, but for a box with a button.
 * The button leads outside, to a meadow in a valley that goes on forever,
 * where the player can walk wherever they like between the hills. Holding
 * the way back inside for a moment (`isHeadingInside`) takes them back to
 * the box with the button.
 */
export interface GameModel {
    /** Every cabinet, the hall's own last. */
    readonly cabinets: readonly Cabinet[];
    /** Whether the player is outside, in the meadow, rather than in a hall. */
    readonly isOutside: boolean;
    /** Whether the hall the player is in has its cabinets. The last hall is empty, and the meadow doesn't have any. */
    readonly hasCabinets: boolean;
    /** The box with the button, in the last hall. */
    readonly buttonBox: Stand;
    /** Whether the player could press the button now, in the last hall, being close to it and facing it. */
    readonly isButtonInReach: boolean;
    /** How white the player's view has turned as they go outside, from 0 to 1. */
    readonly whiteness: number;
    /** The meadow outside. */
    readonly meadow: MeadowTerrain;
    /** The height of the ground under the player, in metres. The hall's floor is at 0. */
    readonly groundHeight: number;
    /** The cabinet at the far end, facing the entrance, which holds the hall itself. */
    readonly hallCabinet: Cabinet;
    /** How many halls deep the player is: 0 in the hall itself, and one more for each time they step into the hall's own cabinet. */
    readonly depth: number;
    /** Whether the player is walking near the door out of a hall inside a cabinet, and facing it. */
    readonly isNearDoor: boolean;
    /** Whether the hall's door leads out: in a hall inside a cabinet, out to the hall outside it. The hall itself has its door shut. */
    readonly isDoorOpen: boolean;
    /**
     * Whether the player means to go back inside, from the meadow. Held for
     * a moment (`HEAD_INSIDE_MS`), as the view starts to turn white, it
     * takes them inside. If they let go sooner, they stay outside.
     */
    isHeadingInside: boolean;
    readonly mode: HallMode;
    /** Where the player stands, in metres, and the way they face. */
    readonly playerX: number;
    readonly playerZ: number;
    readonly playerHeading: number;
    /** How far the player looks up, in radians, or down for less than 0. */
    readonly playerPitch: number;
    /** The cabinet the player could play now, being close to it and facing it, while walking. */
    readonly cabinetInReach: Cabinet | undefined;
    /** The cabinet the player steps up to, plays and steps back from, until they walk again. */
    readonly cabinetInPlay: Cabinet | undefined;
    /**
     * How far the player has leant in to the cabinet in play, from 0 to 1.
     * It's 0 while walking, rises as they step up, is 1 while they play, and
     * falls as they step back.
     */
    readonly lean: number;
    walking: Walking;
    /** Stepping sideways, without turning. */
    strafing: Strafing;
    /** Turns the player on the spot, by `radians`, to the right for more than 0, while walking. */
    readonly turnBy: (radians: number) => void;
    /** Tilts the player's view up by `radians`, or down for less than 0, while walking, as far as a neck bends. */
    readonly tiltBy: (radians: number) => void;
    /** Steps up to the cabinet in reach, to play it once the step is done. */
    readonly playCabinetInReach: () => void;
    /** Steps back from the cabinet stepped up to, or played, and walks again once the step is done. */
    readonly stopPlaying: () => void;
    /** Presses the button in the last hall, which goes outside once the view has faded to white. */
    readonly goOutside: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** How many cabinets stand along the two long walls. One more stands at the far end, and holds the hall itself. */
    readonly cabinetCount: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the hall, with the player at the entrance, facing down the aisle. */
export function createGameModel({ cabinetCount }: GameModelOptions): GameModel {
    const cabinets = layOutCabinets(cabinetCount);
    const hallCabinet = cabinets[cabinetCount];
    const player = createWalkerModel({
        radius: PLAYER_RADIUS,
        walkSpeed: WALK_SPEED,
        facingCosine: FACING_COSINE,
        startPitch: START_PITCH,
        maxPitch: MAX_PITCH,
        x: START_X,
        z: 0,
        heading: 0,
    });
    let depth = 0;
    let mode: HallMode = 'walking';
    let cabinetInReach: Cabinet | undefined;
    let cabinetInPlay: Cabinet | undefined;
    let isOutside = false;
    let isButtonInReach = false;
    /** How long the step up or back, or the fade, has lasted. */
    let stepMs = 0;
    let isHeadingInside = false;
    /** How long the way back inside has been held for, in the meadow. */
    let headingInsideMs = 0;
    const meadow = createMeadowTerrain({ seed: MEADOW_SEED, clearingX: MEADOW_START_X, clearingZ: MEADOW_START_Z });
    /** The trunk being pushed against, moved from tree to tree, so a frame doesn't allocate. */
    const trunk = { x: 0, z: 0, facing: 0 };

    const model: GameModel = {
        cabinets,
        hallCabinet,
        buttonBox: BUTTON_BOX,
        meadow,
        get isOutside() {
            return isOutside;
        },
        get hasCabinets() {
            return hasCabinets();
        },
        get isButtonInReach() {
            return isButtonInReach;
        },
        get whiteness() {
            if (mode === 'going-outside' || mode === 'going-inside') return stepMs / WHITE_OUT_MS;
            if (mode === 'arriving') return 1 - stepMs / WHITE_IN_MS;
            // The view starts to whiten as the way back inside is held, so the player sees it's working
            return (headingInsideMs / HEAD_INSIDE_MS) * HEADING_INSIDE_WHITENESS;
        },
        get groundHeight() {
            return isOutside ? meadow.heightAt(player.x, player.z) : 0;
        },
        get depth() {
            return depth;
        },
        get isNearDoor() {
            // The door faces +x, so facing it means looking toward -x
            return mode === 'walking' && isDoorOpen() && Math.hypot(player.x - DOOR_X, player.z) < DOOR_HINT_DISTANCE && -Math.cos(player.heading) > FACING_COSINE;
        },
        get isDoorOpen() {
            return isDoorOpen();
        },
        get isHeadingInside() {
            return isHeadingInside;
        },
        set isHeadingInside(value) {
            isHeadingInside = value;
            if (!value) headingInsideMs = 0;
        },
        get mode() {
            return mode;
        },
        get playerX() {
            return player.x;
        },
        get playerZ() {
            return player.z;
        },
        get playerHeading() {
            return player.heading;
        },
        get playerPitch() {
            return player.pitch;
        },
        get cabinetInReach() {
            return cabinetInReach;
        },
        get cabinetInPlay() {
            return cabinetInPlay;
        },
        get lean() {
            switch (mode) {
                case 'walking':
                case 'going-outside':
                case 'going-inside':
                case 'arriving':
                    return 0;
                case 'stepping-up':
                    return stepMs / STEP_MS;
                case 'playing':
                    return 1;
                case 'stepping-back':
                    return 1 - stepMs / STEP_MS;
            }
        },
        get walking() {
            return player.walking;
        },
        set walking(value) {
            player.walking = value;
        },
        get strafing() {
            return player.strafing;
        },
        set strafing(value) {
            player.strafing = value;
        },

        turnBy(radians) {
            if (mode === 'walking') player.turnBy(radians);
        },

        tiltBy(radians) {
            if (mode === 'walking') player.tiltBy(radians);
        },

        playCabinetInReach() {
            if (mode !== 'walking' || cabinetInReach === undefined) return;
            mode = 'stepping-up';
            stepMs = 0;
            cabinetInPlay = cabinetInReach;
            cabinetInReach = undefined;
        },

        goOutside() {
            if (mode !== 'walking' || isOutside || depth < FINAL_DEPTH) return;
            mode = 'going-outside';
            stepMs = 0;
            isButtonInReach = false;
        },

        stopPlaying() {
            if ((mode !== 'stepping-up' && mode !== 'playing') || cabinetInPlay === undefined) return;
            // Stepping back part way up takes as long as the part stepped
            stepBackFrom(cabinetInPlay, mode === 'stepping-up' ? STEP_MS - stepMs : 0);
        },

        update(deltaMs) {
            if (mode === 'going-outside' || mode === 'going-inside') {
                stepMs = Math.min(WHITE_OUT_MS, stepMs + deltaMs);
                if (stepMs < WHITE_OUT_MS) return;
                if (mode === 'going-outside') arriveOutside();
                else arriveInside();
                return;
            }
            if (mode === 'arriving') {
                stepMs = Math.min(WHITE_IN_MS, stepMs + deltaMs);
                if (stepMs === WHITE_IN_MS) mode = 'walking';
                return;
            }
            if (mode === 'stepping-up' || mode === 'stepping-back') {
                stepMs = Math.min(STEP_MS, stepMs + deltaMs);
                if (stepMs < STEP_MS) return;
                if (mode === 'stepping-up' && cabinetInPlay === hallCabinet) {
                    enterHallInCabinet();
                    return;
                }
                if (mode === 'stepping-up') {
                    mode = 'playing';
                    return;
                }
                mode = 'walking';
                cabinetInPlay = undefined;
                findCabinetInReach();
                return;
            }
            if (mode !== 'walking') return;
            player.update(deltaMs);
            if (isOutside) {
                keepPlayerOnValleyFloor();
                headingInsideMs = isHeadingInside ? Math.min(HEAD_INSIDE_MS, headingInsideMs + deltaMs) : 0;
                if (headingInsideMs === HEAD_INSIDE_MS) {
                    mode = 'going-inside';
                    // The fade carries on from the whiteness the hold reached, rather than starting again from clear
                    stepMs = HEADING_INSIDE_WHITENESS * WHITE_OUT_MS;
                    headingInsideMs = 0;
                }
                return;
            }
            keepPlayerClear();
            if (isDoorOpen() && isInDoorway()) {
                leaveHallInCabinet();
                return;
            }
            findCabinetInReach();
        },
    };
    return model;

    /**
     * Steps back from `cabinet`, starting `alreadyMs` into the step. The
     * player ends up square in front of the cabinet, a step back, so the
     * whole of it is in view.
     */
    function stepBackFrom(cabinet: Cabinet, alreadyMs: number): void {
        mode = 'stepping-back';
        stepMs = alreadyMs;
        cabinetInPlay = cabinet;
        cabinetInReach = undefined;
        player.standBefore(cabinet, CABINET_DEPTH, PLAY_DISTANCE + STEP_BACK);
        keepPlayerClear();
    }

    /** Goes into the hall on the hall cabinet's screen, which puts the player back at the entrance, one hall deeper. */
    function enterHallInCabinet(): void {
        depth++;
        mode = 'walking';
        cabinetInPlay = undefined;
        player.placeAt(START_X, 0, 0);
        findCabinetInReach();
    }

    /** Goes out through the door, one hall shallower, stepping back from the hall cabinet there, as if out of its screen. */
    function leaveHallInCabinet(): void {
        depth--;
        stepBackFrom(hallCabinet, 0);
    }

    /** Whether the hall has its cabinets: any hall but the last, which is empty. */
    function hasCabinets(): boolean {
        return !isOutside && depth < FINAL_DEPTH;
    }

    /** Puts the player outside, once the view is white, in the clearing in the meadow, facing down the valley. */
    function arriveOutside(): void {
        isOutside = true;
        mode = 'arriving';
        stepMs = 0;
        player.placeAt(MEADOW_START_X, MEADOW_START_Z, MEADOW_START_HEADING);
    }

    /**
     * Puts the player back in the last hall, once the view is white, a step
     * back from the box with the button, facing it, to go out again if they
     * like.
     */
    function arriveInside(): void {
        isOutside = false;
        mode = 'arriving';
        stepMs = 0;
        isHeadingInside = false;
        player.standBefore(BUTTON_BOX, BUTTON_BOX_DEPTH, BUTTON_DISTANCE + STEP_BACK);
        keepPlayerClear();
    }

    /** Whether the hall's door leads out, as it does from a hall inside a cabinet. */
    function isDoorOpen(): boolean {
        return !isOutside && depth > 0;
    }

    /** Whether the player has walked up to the door. */
    function isInDoorway(): boolean {
        return player.x <= -HALL_LENGTH / 2 + PLAYER_RADIUS + DOORWAY_DEPTH && Math.abs(player.z) < DOOR_WIDTH / 2;
    }

    /** Pushes the player out of each cabinet they overlap, or the button's box in the last hall, then back inside the walls. */
    function keepPlayerClear(): void {
        if (hasCabinets()) {
            for (let i = 0; i < cabinets.length; i++) player.pushOutOf(cabinets[i], CABINET_DEPTH, CABINET_WIDTH);
        }
        else player.pushOutOf(BUTTON_BOX, BUTTON_BOX_DEPTH, BUTTON_BOX_WIDTH);
        player.keepInside(-HALL_LENGTH / 2, HALL_LENGTH / 2, -HALL_WIDTH / 2, HALL_WIDTH / 2);
    }

    /**
     * Pushes the player away from the trunks of the trees in the cells round
     * them, then keeps them off the valley's steep sides. The sides come
     * last, since a push from a trunk could take the player onto them.
     */
    function keepPlayerOnValleyFloor(): void {
        const col = Math.floor(player.x);
        const row = Math.floor(player.z);
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (meadow.kindAt(c, r) !== 'tree') continue;
                trunk.x = c + 0.5;
                trunk.z = r + 0.5;
                player.pushOutOf(trunk, TRUNK_WIDTH, TRUNK_WIDTH);
            }
        }
        // The valley's walk says where the player's middle may go. `keepInside` keeps their whole circle in, so the walk is widened by a radius each side
        const middle = meadow.valleyMiddleAt(player.x);
        const edge = VALLEY_WALK_HALF_WIDTH + PLAYER_RADIUS;
        player.keepInside(-Infinity, Infinity, middle - edge, middle + edge);
    }

    /** Finds the cabinet in reach, or in the last hall, whether the button is. */
    function findCabinetInReach(): void {
        cabinetInReach = undefined;
        isButtonInReach = false;
        if (!hasCabinets()) {
            isButtonInReach = player.distanceToUse(BUTTON_BOX, BUTTON_BOX_DEPTH, BUTTON_DISTANCE) < REACH;
            return;
        }
        let nearest = REACH;
        for (let i = 0; i < cabinets.length; i++) {
            const distance = player.distanceToUse(cabinets[i], CABINET_DEPTH, PLAY_DISTANCE);
            if (distance < nearest) {
                nearest = distance;
                cabinetInReach = cabinets[i];
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the player looks down at first, so the cabinets' screens sit in the middle of the view, and how far they can look up or down. */
const START_PITCH = -0.12;
const MAX_PITCH = 1.2;
/** How far the player steps back from a cabinet when they stop playing it. */
const STEP_BACK = 0.5;
/** Where the player starts, a step in from the entrance wall. */
const START_X = -HALL_LENGTH / 2 + 1;
const BUTTON_BOX: Stand = { x: BUTTON_BOX_X, z: 0, facing: Math.PI };
/** Where the player stands to press the button, further back than at a cabinet, as the box is low, so it's in view. */
const BUTTON_DISTANCE = 1.1;
/** Where the player arrives in the meadow. It is a clearing by the river, and they face down the valley, toward the mountains. */
const MEADOW_SEED = 2718;
const MEADOW_START_X = 0.5;
const MEADOW_START_Z = 7.5;
const MEADOW_START_HEADING = 0;
/** How white the view turns as the way back inside is held, just before the player goes. */
const HEADING_INSIDE_WHITENESS = 0.35;
/** The middle of the door out, in the entrance wall. */
const DOOR_X = -HALL_LENGTH / 2;
/** How close to the entrance wall the player gets before the door takes them through it. */
const DOORWAY_DEPTH = 0.02;

/**
 * Stands the cabinets along the two long walls, backs to the wall, the first
 * wall's from the entrance end, then the hall's own at the far end, facing
 * the entrance.
 */
function layOutCabinets(count: number): Cabinet[] {
    if (count > 2 * CABINETS_PER_WALL) throw new Error(`arcade hall: ${count} games, but the hall's two walls hold ${2 * CABINETS_PER_WALL}`);
    const cabinets: Cabinet[] = [];
    const firstX = -((CABINETS_PER_WALL - 1) * CABINET_SPACING) / 2 + 0.6;
    const wallZ = HALL_WIDTH / 2 - CABINET_DEPTH / 2 - 0.05;
    for (let index = 0; index < count; index++) {
        const isFirstWall = index < CABINETS_PER_WALL;
        const slot = index % CABINETS_PER_WALL;
        cabinets.push({
            index,
            x: firstX + slot * CABINET_SPACING,
            // The first wall is at -z, so its cabinets face +z, and the second wall's face back
            z: isFirstWall ? -wallZ : wallZ,
            facing: isFirstWall ? Math.PI / 2 : -Math.PI / 2,
        });
    }
    cabinets.push({ index: count, x: HALL_LENGTH / 2 - CABINET_DEPTH / 2 - 0.05, z: 0, facing: Math.PI });
    return cabinets;
}
